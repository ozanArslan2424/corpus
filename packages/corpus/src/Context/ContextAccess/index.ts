/**
 * Works out which parts of a request a route actually uses, so the rest can be
 * skipped.
 *
 * Parsing a body, a query string and path parameters costs work, and most
 * handlers only use one of them. Before serving a route, {@link App} asks this
 * module what the handler chain reads and then parses only that.
 *
 * The answer comes from reading the handler's own source: `fn.toString()` gives
 * back the function's text, and every mention of the context parameter is
 * checked. `c.body` is a read of the body. `({ params }) => …` is a read of the
 * params. Anything less obvious — passing `c` to another function, returning it,
 * indexing it with a variable — means the handler could reach anything, so
 * everything gets parsed.
 *
 * That fallback is the rule the whole module follows: when in doubt, parse it
 * all. Guessing "unused" wrongly would hand a handler an empty body it was
 * counting on. Guessing "used" wrongly just does some work nobody needed.
 *
 * @module ContextAccess
 */

import type { Context } from "@/Context";
import type { RouteConfig } from "@/RouteBase";
import { isPresent, type Nullable, type Optional } from "@/utils/is";
import { memo } from "@/utils/memo";

/** One of the skippable {@link Context} properties: `body`, `search` or `params`. */
type ContextAccessKey = keyof Context | "reqBody";

/** Which properties to parse. `true` means the handler chain might read it. */
type ContextAccess = Record<ContextAccessKey, boolean>;

const BODY_METHODS = new Set(["json", "text", "arrayBuffer", "formData", "body", "clone", "bytes"]);

/**
 * Every key of {@link ContextAccess}, in a fixed order. Hoisted so the merge
 * loops do not rebuild it per route; `satisfies` keeps it checked against the
 * key type without widening the tuple.
 */
const KEYS = [
	"body",
	"search",
	"params",
	"data",
	"server",
	"req",
	"res",
	"url",
	"reqBody",
] as const satisfies ReadonlyArray<ContextAccessKey>;

/** Membership test for a key read out of source text. */
const KEY_SET: ReadonlySet<string> = new Set(KEYS);

/**
 * One regex per key, matching that key as a binding inside a destructuring
 * pattern. Built once: the pattern depends only on the key, and recompiling
 * nine of them per call was the bulk of {@link getPatternAccess}.
 *
 * The trailing class matches the four ways a destructured binding can end:
 * `body,` `body:` `body}` `body=`. The lookbehind rejects `req.body` and the
 * lookahead rejects `bodyParser`.
 */
const PATTERN_KEY: ReadonlyMap<ContextAccessKey, RegExp> = new Map(
	KEYS.map((key) => [key, new RegExp(`(?<![\\w$.])${key}(?![\\w$])\\s*[,:}=]`)] as const),
);

/**
 * `c.body`, `c?.body`. Sticky, so it can be aimed at an index in the body text
 * rather than at a freshly sliced tail.
 */
const DOT = /\s*\??\.\s*([A-Za-z_$][\w$]*)/y;

/**
 * `c["body"]`, `c?.["body"]`. The backreference forces matching quotes and the
 * character class rejects escapes, so only literal static keys are accepted.
 * Sticky, for the same reason as {@link DOT}.
 */
const BRACKET = /\s*\??\.?\[\s*(["'])([^"'\\]*)\1\s*\]/y;

/** A bare identifier, used to validate the context parameter's name. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Splits a parameter on whitespace or `=`, to strip defaults and annotations. */
const PARAM_SPLIT = /[\s=]/;

/**
 * The conservative fallback: every property is parsed. Returned whenever the
 * analysis cannot prove a property is unused.
 *
 * Frozen and shared — the analysis results are cached, so a caller that mutated
 * one would corrupt every later lookup.
 */
const ALL: ContextAccess = Object.freeze({
	body: true,
	search: true,
	params: true,
	data: true,
	server: true,
	req: true,
	res: true,
	url: true,
	reqBody: true,
});

/**
 * Fresh zeroed record. A factory, not a shared constant — callers mutate it.
 *
 * @returns A record with every key set to `false`.
 */
function none(): ContextAccess {
	return {
		body: false,
		search: false,
		params: false,
		data: false,
		server: false,
		req: false,
		res: false,
		url: false,
		reqBody: false,
	};
}

/**
 * @param char - The character to test.
 * @returns `true` for the whitespace this scanner cares about.
 */
function isSpace(char: string): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}

/**
 * Walks backwards past whitespace.
 *
 * Replaces slicing the whole text before a match and calling `trimEnd` on it —
 * that allocated a copy of the body per mention of the context parameter.
 *
 * @param source - The text to scan.
 * @param from - Index to start before; the character at `from` is not examined.
 * @returns The index of the last non-whitespace character before `from`, or -1
 * when there is none.
 */
function prevNonSpace(source: string, from: number): number {
	let i = from - 1;
	while (i >= 0 && isSpace(source[i]!)) i--;
	return i;
}

/**
 * Scans forward through source text looking for a character, ignoring anything
 * inside brackets or string literals.
 *
 * Used to find the end of a parameter list without being fooled by a comma in a
 * default value or a closing paren inside a string.
 *
 * @param source - The text to scan.
 * @param from - Index to start at.
 * @param stop - Called for each candidate character with the current bracket
 * depth. Return anything other than `null` to stop here; the value itself is
 * ignored.
 * @returns The index where the scan stopped, or -1 if it ran off the end.
 */
function scan(
	source: string,
	from: number,
	stop: (char: string, depth: number) => Nullable<number>,
): number {
	let depth = 0;
	// Empty string means "not currently inside a literal"; otherwise it holds
	// the quote character that will close the literal.
	let quote = "";

	for (let i = from; i < source.length; i++) {
		const char = source[i]!;

		if (quote) {
			// Skip the escaped character wholesale so an escaped quote does not
			// read as a terminator.
			if (char === "\\") i++;
			else if (char === quote) quote = "";
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "(" || char === "[" || char === "{") {
			depth++;
			continue;
		}
		if (char === ")" || char === "]" || char === "}") {
			depth--;
			// Closers are only offered to `stop` when they return to the top
			// level, so a nested `)` cannot be mistaken for the one that ends
			// the parameter list.
			if (depth === 0 && stop(char, depth) !== null) return i;
			continue;
		}
		if (stop(char, depth) !== null) return i;
	}

	return -1;
}

/**
 * Splits a function's source text into its first parameter and its body.
 *
 * The first parameter is the context; the body is where reads of it are
 * counted. Handles both `(c) => …` and the parenless `c => …`.
 *
 * @param source - The function's `toString()` output.
 * @returns The first parameter and the body text, or `null` when no parameter
 * list could be found — which the caller treats as unanalyzable.
 */
function getSignature(source: string): Nullable<{ firstParam: string; body: string }> {
	// Parenless arrow: `c => ...` or `async c => ...`. There is no bracket pair
	// to scan for, so the identifier is captured directly.
	const bare = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(source);
	if (bare && bare[1]) {
		const firstParam = bare[1].trim();
		const body = source.slice(bare[0].length);
		return { firstParam, body };
	}

	const opening = source.indexOf("(");
	if (opening === -1) return null;

	// Depth starts at 0 and the opening paren immediately raises it, so depth
	// returning to 0 marks the matching close.
	const closing = scan(source, opening, (_char, depth) => (depth === 0 ? -1 : null));
	if (closing === -1) return null;

	const params = source.slice(opening + 1, closing);
	// A top-level comma ends the first parameter. Commas nested inside a
	// destructuring pattern or a default value sit at depth > 0 and are ignored.
	const comma = scan(params, 0, (char, depth) => (char === "," && depth === 0 ? -1 : null));
	// -1 means no top-level comma was found, i.e. the whole list is one parameter.
	const firstParam = (comma === -1 ? params : params.slice(0, comma)).trim();
	const body = source.slice(closing + 1);

	return { firstParam, body };
}

/**
 * Reads which keys a destructuring pattern pulls out, as in
 * `({ body, params }) => …`.
 *
 * @param pattern - The pattern text, braces included.
 * @returns Which keys it binds, or `null` when the pattern has a rest element —
 * that captures everything left over, so no key can be ruled out.
 */
function getPatternAccess(pattern: string): Nullable<ContextAccess> {
	if (pattern.includes("...")) return null;

	const access = none();
	for (const key of KEYS) {
		if (PATTERN_KEY.get(key)!.test(pattern)) access[key] = true;
	}
	return access;
}

/**
 * Finds the `{` that opens the block ending at `closing`, by counting brackets
 * backwards.
 *
 * @param source - The text to search.
 * @param closing - Index of the closing brace.
 * @returns The opening brace's index, or -1 when the brackets do not pair up —
 * which sends the caller to {@link ALL}.
 */
function getOpeningBrace(source: string, closing: number): number {
	let depth = 0;
	for (let i = closing; i >= 0; i--) {
		const char = source[i]!;
		if (char === "}" || char === ")" || char === "]") depth++;
		else if (char === "{" || char === "(" || char === "[") {
			depth--;
			if (depth === 0) return char === "{" ? i : -1;
		}
	}
	return -1;
}

/**
 * Analyzes one function.
 *
 * Finds the context parameter, then walks every mention of it in the body. A
 * mention it can read as a property access records that key; a mention it
 * cannot falls back to {@link ALL}.
 *
 * Memoized on the function's identity: the same {@link Middleware} handler
 * appears in every route it guards, and re-reading its source per route was
 * pure repetition. The cache is weak, so a handler that goes away takes its
 * entry with it. The results it hands back are shared, so no caller may mutate
 * one.
 *
 * @param fn - The handler to analyze.
 * @returns Which properties this function might read.
 */
const getSingleContextAccess = memo((fn: Function): ContextAccess => {
	const source = fn.toString();
	// Bound, native, or otherwise opaque functions expose no readable body.
	if (source.includes("[native code]")) return ALL;

	const signature = getSignature(source);
	if (signature === null) return ALL;

	const { firstParam, body } = signature;

	// Destructured context: `({ body, search }) => ...`. The pattern itself
	// names everything the function can reach, so the body needs no scanning.
	if (firstParam.startsWith("{")) {
		const patternAccess = getPatternAccess(firstParam);
		return patternAccess ?? ALL;
	}

	// Strip any default value or type annotation to leave a bare identifier.
	const name = firstParam.split(PARAM_SPLIT)[0] ?? "";
	// Anything that is not a plain identifier — an array pattern, an empty
	// parameter list, minifier output this parser does not model — is unanalyzable.
	if (!IDENTIFIER.test(name)) return ALL;

	const access = none();
	// Property positions (`x.c`) are excluded below rather than in the pattern,
	// because a spread's trailing dot is indistinguishable from member access
	// to a lookbehind. Longer identifiers that merely start with the name
	// (`ctx2`) are still rejected here.
	const identifier = new RegExp(`(?<![\\w$])${name}(?![\\w$])`, "g");

	// An exec loop rather than `matchAll`, which allocates an iterator on top of
	// the match objects.
	let match: Nullable<RegExpExecArray>;
	while ((match = identifier.exec(body)) !== null) {
		// Bun's transpiler merges consecutive property reads into one
		// destructuring assignment, so `const a = c.body; const b = c.params`
		// arrives here as `const { body: a, params: b } = c`. The pattern names
		// everything the statement can reach, so it is read rather than
		// treated as an escape.
		//
		// The text before the match is addressed by index instead of being
		// sliced out: `head` ends at `h`, and every test below is a character
		// comparison there.
		const h = prevNonSpace(body, match.index);
		const headChar = h >= 0 ? body[h]! : "";

		// `x.c` is a property that happens to share the parameter's name. `...c`
		// is the parameter itself being spread, and its third dot must not be
		// mistaken for member access.
		if (headChar === "." && !(body[h - 1] === "." && body[h - 2] === ".")) continue;

		const after = match.index + name.length;

		// `c.body`, `c?.body`
		DOT.lastIndex = after;
		const dot = DOT.exec(body);
		if (dot) {
			const key = dot[1] as ContextAccessKey;
			if (KEY_SET.has(key)) access[key] = true;

			if (key === "req") {
				// `DOT.lastIndex` already sits just past `.req`, so this picks up
				// where the first match left off without slicing a tail.
				const nested = DOT.exec(body);
				if (nested && BODY_METHODS.has(nested[1]!)) {
					access.reqBody = true;
				} else if (!nested) {
					// c.req used bare (passed somewhere, awaited directly, etc.) —
					// can't rule out body access
					access.reqBody = true;
				}
			}
			continue;
		}

		// `c["body"]`, `c?.["body"]`.
		BRACKET.lastIndex = after;
		const bracket = BRACKET.exec(body);
		if (bracket) {
			const key = bracket[2] as ContextAccessKey;
			if (KEY_SET.has(key)) access[key] = true;
			continue;
		}

		// A bare `=` only. `==`, `===`, `!=`, `>=` and `<=` are comparisons, in
		// which the context is being used as a value.
		const beforeHead = h >= 1 ? body[h - 1]! : "";
		const isComparison =
			beforeHead === "=" || beforeHead === "!" || beforeHead === "<" || beforeHead === ">";
		if (headChar === "=" && !isComparison) {
			// `target` is everything before the `=`, trimmed; `t` is its last
			// character. Scanning backwards from `t` in the full body visits the
			// same characters at the same indices that scanning `target` did.
			const t = prevNonSpace(body, h);
			if (t >= 0 && body[t] === "}") {
				const opening = getOpeningBrace(body, t);
				if (opening !== -1) {
					const patternAccess = getPatternAccess(body.slice(opening, t + 1));
					if (patternAccess === null) return ALL;
					for (const key of KEYS) access[key] ||= patternAccess[key];
					continue;
				}
			}
		}

		// The context escapes as a value here: passed to another function,
		// destructured, returned, or indexed with a computed key. Nothing
		// can be ruled out, so everything is parsed.
		return ALL;
	}

	return access;
});

/**
 * Combines every handler in a route's chain into one answer.
 *
 * A property is parsed if any handler reads it, so a {@link Middleware} that
 * needs the body still gets one even when the route handler ignores it. A key
 * with a schema in the route's {@link RouteConfig} is always parsed — skipping
 * it would let an invalid payload through unvalidated.
 *
 * @param handlers - Every function in the chain, middleware and route handler
 * alike.
 * @param config - The route's config, read for its schemas.
 * @returns Which properties {@link App} should populate on the
 * {@link Context}.
 */
function getContextAccess(
	handlers: ReadonlyArray<Function>,
	config: Optional<RouteConfig>,
): ContextAccess {
	const result = none();

	for (const handler of handlers) {
		const access = getSingleContextAccess(handler);
		// Every key is already set; no later handler can widen this further.
		let complete = true;
		for (const key of KEYS) {
			result[key] ||= access[key];
			if (!result[key]) complete = false;
		}
		if (complete) break;
	}

	// A configured schema runs whether or not a handler reads the value —
	// skipping it would let an invalid payload through unvalidated.
	return {
		...result,
		params: result.params || isPresent(config?.params),
		search: result.search || isPresent(config?.search),
		body: result.body || isPresent(config?.body),
	};
}

export { getContextAccess };

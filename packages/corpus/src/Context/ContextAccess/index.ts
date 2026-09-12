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

/** One of the skippable {@link Context} properties: `body`, `search` or `params`. */
type ContextAccessKey = keyof Context | "reqBody";

/** Which properties to parse. `true` means the handler chain might read it. */
type ContextAccess = Record<ContextAccessKey, boolean>;

const BODY_METHODS = new Set(["json", "text", "arrayBuffer", "formData", "body", "clone", "bytes"]);

/**
 * The conservative fallback: every property is parsed. Returned whenever the
 * analysis cannot prove a property is unused.
 *
 * @returns A record with every key set to `true`.
 */
function all(): ContextAccess {
	return {
		body: true,
		search: true,
		params: true,
		data: true,
		server: true,
		req: true,
		res: true,
		url: true,
		reqBody: true,
	};
}

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
function getPatternAccess(pattern: string, keys: Array<ContextAccessKey>): Nullable<ContextAccess> {
	if (pattern.includes("...")) return null;

	const access = none();
	for (const key of keys) {
		// The trailing class matches the four ways a destructured binding can
		// end: `body,` `body:` `body}` `body=`. The lookbehind rejects
		// `req.body` and the lookahead rejects `bodyParser`.
		if (new RegExp(`(?<![\\w$.])${key}(?![\\w$])\\s*[,:}=]`).test(pattern)) access[key] = true;
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
 * which sends the caller to {@link all}.
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
 * cannot falls back to {@link all}.
 *
 * @param fn - The handler to analyze.
 * @returns Which properties this function might read.
 */
function getSingleContextAccess(fn: Function, keys: Array<ContextAccessKey>): ContextAccess {
	const source = fn.toString();
	// Bound, native, or otherwise opaque functions expose no readable body.
	if (source.includes("[native code]")) return all();

	const signature = getSignature(source);
	if (signature === null) return all();

	const { firstParam, body } = signature;

	// Destructured context: `({ body, search }) => ...`. The pattern itself
	// names everything the function can reach, so the body needs no scanning.
	if (firstParam.startsWith("{")) {
		const patternAccess = getPatternAccess(firstParam, keys);
		return patternAccess ?? all();
	}

	// Strip any default value or type annotation to leave a bare identifier.
	const name = firstParam.split(/[\s=]/)[0] ?? "";
	// Anything that is not a plain identifier — an array pattern, an empty
	// parameter list, minifier output this parser does not model — is unanalyzable.
	if (!/^[A-Za-z_$][\w$]*$/.test(name)) return all();

	const access = none();
	// Property positions (`x.c`) are excluded below rather than in the pattern,
	// because a spread's trailing dot is indistinguishable from member access
	// to a lookbehind. Longer identifiers that merely start with the name
	// (`ctx2`) are still rejected here.
	const identifier = new RegExp(`(?<![\\w$])${name}(?![\\w$])`, "g");

	for (const match of body.matchAll(identifier)) {
		// Bun's transpiler merges consecutive property reads into one
		// destructuring assignment, so `const a = c.body; const b = c.params`
		// arrives here as `const { body: a, params: b } = c`. The pattern names
		// everything the statement can reach, so it is read rather than
		// treated as an escape.
		const head = body.slice(0, match.index).trimEnd();

		// `x.c` is a property that happens to share the parameter's name. `...c`
		// is the parameter itself being spread, and its third dot must not be
		// mistaken for member access.
		if (head.endsWith(".") && !head.endsWith("...")) continue;

		const tail = body.slice(match.index + name.length);

		// `c.body`, `c?.body`
		const dot = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(tail);
		if (dot) {
			const key = dot[1] as ContextAccessKey;
			if (keys.includes(key)) access[key] = true;

			if (key === "req") {
				const afterReq = tail.slice(dot[0].length);
				const nested = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(afterReq);
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

		// `c["body"]`, `c?.["body"]`. The backreference forces matching quotes
		// and the character class rejects escapes, so only literal static keys
		// are accepted.
		const bracket = /^\s*\??\.?\[\s*(["'])([^"'\\]*)\1\s*\]/.exec(tail);
		if (bracket) {
			const key = bracket[2] as ContextAccessKey;
			if (keys.includes(key)) access[key] = true;
			continue;
		}

		// A bare `=` only. `==`, `===`, `!=`, `>=` and `<=` are comparisons, in
		// which the context is being used as a value.
		if (head.endsWith("=") && !/[=!<>]=$/.test(head)) {
			const target = head.slice(0, -1).trimEnd();
			if (target.endsWith("}")) {
				const opening = getOpeningBrace(target, target.length - 1);
				if (opening !== -1) {
					const patternAccess = getPatternAccess(target.slice(opening), keys);
					if (patternAccess === null) return all();
					for (const key of keys) access[key] ||= patternAccess[key];
					continue;
				}
			}
		}

		// The context escapes as a value here: passed to another function,
		// destructured, returned, or indexed with a computed key. Nothing
		// can be ruled out, so everything is parsed.
		return all();
	}

	return access;
}

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
	const keys = Object.keys(none()) as Array<ContextAccessKey>;

	for (const handler of handlers) {
		const access = getSingleContextAccess(handler, keys);
		for (const key of keys) result[key] ||= access[key];
		// Every key is already set; no later handler can widen this further.
		if (keys.every((key) => result[key])) break;
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

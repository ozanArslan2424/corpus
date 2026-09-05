import type { RouteConfig } from "@/RouteBase";
import { isUndefined, type Nullable, type Optional } from "@/utils/maybe";

/**
 * The context properties whose population can be skipped. Order is irrelevant;
 * this exists so the key list, the record type, and the runtime loops can never
 * drift apart.
 */
const KEYS = ["body", "search", "params"] as const;

type ContextAccessKey = (typeof KEYS)[number];
type ContextAccess = Record<ContextAccessKey, boolean>;

/**
 * The conservative fallback: every property is parsed. Returned whenever the
 * analysis cannot prove a property is unused.
 */
function all(): ContextAccess {
	return { body: true, search: true, params: true };
}

/** Fresh zeroed record. A factory, not a shared constant — callers mutate it. */
function none(): ContextAccess {
	return { body: false, search: false, params: false };
}

/**
 * Walks `source` from `from`, tracking bracket depth and skipping string
 * literals, until `stop` accepts a character. Returns that character's index,
 * or -1 if the scan runs off the end.
 *
 * `stop` is consulted for its null-ness only — a non-null return means "stop
 * here", and the number itself is discarded. Callers return -1 as the truthy
 * sentinel purely because `Nullable<number>` demands a number.
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
 * Splits a stringified function into its first parameter and everything after
 * the parameter list. Returns null when no parameter list can be located, which
 * the caller treats as unanalyzable.
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
 * Which of the tracked keys a destructuring pattern binds, or null when the
 * pattern has a rest element — that captures the unnamed remainder, which
 * could be read through later by any key.
 */
function getPatternAccess(pattern: string): Nullable<ContextAccess> {
	if (pattern.includes("...")) return null;

	const access = none();
	for (const key of KEYS) {
		// The trailing class matches the four ways a destructured binding can
		// end: `body,` `body:` `body}` `body=`. The lookbehind rejects
		// `req.body` and the lookahead rejects `bodyParser`.
		if (new RegExp(`(?<![\\w$.])${key}(?![\\w$])\\s*[,:}=]`).test(pattern)) access[key] = true;
	}
	return access;
}

/**
 * Index of the `{` matching the closer at `closing`, or -1 if the brace pairs
 * do not resolve. Quotes are not tracked, so a pattern whose default value
 * contains an unbalanced brace inside a string literal will not resolve — that
 * yields -1 and the caller falls back to ALL.
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

/** Which context properties a single function's source proves it reads. */
function getSingleContextAccess(fn: Function): ContextAccess {
	const source = fn.toString();
	// Bound, native, or otherwise opaque functions expose no readable body.
	if (source.includes("[native code]")) return all();

	const signature = getSignature(source);
	if (signature === null) return all();

	const { firstParam, body } = signature;

	// Destructured context: `({ body, search }) => ...`. The pattern itself
	// names everything the function can reach, so the body needs no scanning.
	if (firstParam.startsWith("{")) {
		const patternAccess = getPatternAccess(firstParam);
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
			// A property outside KEYS is a read this module does not care about.
			if (KEYS.includes(key)) access[key] = true;
			continue;
		}

		// `c["body"]`, `c?.["body"]`. The backreference forces matching quotes
		// and the character class rejects escapes, so only literal static keys
		// are accepted.
		const bracket = /^\s*\??\.?\[\s*(["'])([^"'\\]*)\1\s*\]/.exec(tail);
		if (bracket) {
			const key = bracket[2] as ContextAccessKey;
			if (KEYS.includes(key)) access[key] = true;
			continue;
		}

		// A bare `=` only. `==`, `===`, `!=`, `>=` and `<=` are comparisons, in
		// which the context is being used as a value.
		if (head.endsWith("=") && !/[=!<>]=$/.test(head)) {
			const target = head.slice(0, -1).trimEnd();
			if (target.endsWith("}")) {
				const opening = getOpeningBrace(target, target.length - 1);
				if (opening !== -1) {
					const patternAccess = getPatternAccess(target.slice(opening));
					if (patternAccess === null) return all();
					for (const key of KEYS) access[key] ||= patternAccess[key];
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

/** Union across every function that receives the context. */
function getContextAccess(
	handlers: ReadonlyArray<Function>,
	config: Optional<RouteConfig>,
): ContextAccess {
	const result = none();

	for (const handler of handlers) {
		const access = getSingleContextAccess(handler);
		for (const key of KEYS) result[key] ||= access[key];
		// Every key is already set; no later handler can widen this further.
		if (KEYS.every((key) => result[key])) break;
	}

	// A configured schema runs whether or not a handler reads the value —
	// skipping it would let an invalid payload through unvalidated.
	return {
		params: result.params || !isUndefined(config?.params),
		search: result.search || !isUndefined(config?.search),
		body: result.body || !isUndefined(config?.body),
	};
}

export { getContextAccess };

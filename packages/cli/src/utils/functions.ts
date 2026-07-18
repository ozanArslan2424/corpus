export function normalizeFuncBody(func: Function): {
	params: string;
	body: string;
	isExpression: boolean;
	isAsync: boolean;
} {
	const raw = func.toString().trim();
	const isAsync = /^async\s/.test(raw);
	const stripped = isAsync ? raw.replace(/^async\s+/, "") : raw;

	// function [name]?(params) { body }
	const funcMatch = stripped.match(
		/^function\s*\*?\s*[A-Za-z0-9_$]*\s*\(([\s\S]*?)\)\s*\{([\s\S]*)\}\s*$/,
	);
	if (funcMatch) {
		return {
			params: funcMatch[1]?.trim() ?? "",
			body: funcMatch[2]?.trim() ?? "",
			isExpression: false,
			isAsync,
		};
	}

	// (params) => body
	const arrowParen = stripped.match(/^\(([\s\S]*?)\)\s*=>\s*([\s\S]*)$/);
	// singleParam => body
	const arrowNoParen = stripped.match(/^([A-Za-z0-9_$]+)\s*=>\s*([\s\S]*)$/);
	const arrowMatch = arrowParen ?? arrowNoParen;

	if (arrowMatch) {
		const params = arrowMatch[1]?.trim() ?? "";
		let body = arrowMatch[2]?.trim() ?? "";
		const isExpression = !(body.startsWith("{") && body.endsWith("}"));
		if (!isExpression) body = body.slice(1, -1).trim();
		return { params, body, isExpression, isAsync };
	}

	throw new Error(`Unable to parse function source: ${raw}`);
}

/**
 * Finds the function enclosing a match index using brace matching.
 * Returns the function's name, or null when the match is already top level.
 */
export function findEnclosingFunctionName(source: string, matchIndex: number): string | null {
	// walk backwards, tracking depth, to find the opening brace of the enclosing block
	let depth = 0;
	let openIndex = -1;
	for (let i = matchIndex; i >= 0; i--) {
		const ch = source[i];
		if (ch === "}") depth++;
		else if (ch === "{") {
			if (depth === 0) {
				openIndex = i;
				break;
			}
			depth--;
		}
	}
	if (openIndex === -1) return null; // top level

	const before = source.slice(0, openIndex);
	// function name(...) {  |  const name = (...) => {  |  const name = async function (...) {
	const decl =
		before.match(/(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)\s*\([\s\S]*?\)\s*$/) ??
		before.match(
			/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\s*)?\([\s\S]*?\)\s*(?:=>)?\s*$/,
		);

	return decl?.[1] ?? null;
}

export type Func<Args extends any[] = any[], Return = any> = (...args: Args) => Return;

export function internFunc<T extends Func>(
	map: Map<string, T>,
	value: T,
	...namespace: string[]
): T {
	const key = namespace.join("::");
	const existing = map.get(key);
	if (existing) return existing;
	map.set(key, value);
	return value;
}

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

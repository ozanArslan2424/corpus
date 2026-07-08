import ts from "typescript";

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

export function hoistFunctionBody(source: string): string {
	const sourceFile = ts.createSourceFile(
		"temp.ts",
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	let targetFunc: ts.FunctionDeclaration | undefined;

	function findListen(node: ts.Node): boolean {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === "listen"
		) {
			return true;
		}
		return ts.forEachChild(node, findListen) ?? false;
	}

	function findFunc(node: ts.Node) {
		if (ts.isFunctionDeclaration(node) && findListen(node)) {
			targetFunc ??= node;
			return;
		}
		ts.forEachChild(node, findFunc);
	}

	findFunc(sourceFile);

	if (!targetFunc?.body) return source;

	const funcName = targetFunc.name?.text;
	const printer = ts.createPrinter();
	const hoisted = targetFunc.body.statements
		.map((stmt) => printer.printNode(ts.EmitHint.Unspecified, stmt, sourceFile))
		.join("\n");

	const before = source.slice(0, targetFunc.getStart(sourceFile));
	const after = source.slice(targetFunc.getEnd());
	let result = before + hoisted + after;

	// remove the call site too
	if (funcName) {
		result = result.replace(
			new RegExp(`^\\s*(?:void|await)?\\s*${funcName}\\s*\\(.*?\\);.*$`, "m"),
			"",
		);
	}

	return result;
}

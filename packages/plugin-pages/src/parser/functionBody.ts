import { skipQuoteString, skipTemplateLiteral } from "@/parser/lex";

/**
 * The body of a function as statements, from its source. Works for declarations and expressions, `async`,
 * generators, methods (`name() {}`, `get x() {}`, `[key]() {}`) and arrows. An expression-bodied arrow
 * becomes `return <expression>;`.
 */
export function functionBody(fn: Function): string {
	const text = fn.toString();
	let depth = 0;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		if (ch === '"' || ch === "'") i = skipQuoteString(text, i);
		else if (ch === "`") i = skipTemplateLiteral(text, i);
		else if (ch === "/" && text[i + 1] === "/")
			i = text.indexOf("\n", i) === -1 ? text.length : text.indexOf("\n", i);
		else if (ch === "/" && text[i + 1] === "*") i = text.indexOf("*/", i + 2) + 1;
		else if (ch === "(" || ch === "[") depth++;
		else if (ch === ")" || ch === "]") depth--;

		// The first `{` or `=>` outside the parameters and computed name is where the body starts.
		else if (depth === 0 && ch === "{") return text.slice(i + 1, text.lastIndexOf("}")).trim();
		else if (depth === 0 && ch === "=" && text[i + 1] === ">") {
			const rest = text.slice(i + 2).trim();
			return rest.startsWith("{") ? rest.slice(1, rest.lastIndexOf("}")).trim() : `return ${rest};`;
		}
	}

	throw new Error(`Couldn't find the body of: ${text}`);
}

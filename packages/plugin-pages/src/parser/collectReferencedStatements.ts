import { skipQuoteString } from "@/parser/lex";

/** Identifiers in `code` that can reference a binding: strings, template text, comments and `.property` names are skipped. */
function referencedNames(code: string): Set<string> {
	const names = new Set<string>();
	// Template nesting: each entry is the brace depth at which a `${` expression returns to its template.
	const templates: Array<number> = [];
	let depth = 0;
	let i = 0;

	/** Moves past template text to the template's end or into its next `${` expression, whichever comes first. */
	function skipToInterpolation(): void {
		while (i < code.length) {
			const ch = code[i];

			if (ch === "\\") {
				// Skip the escaped character too.
				i += 2;
				continue;
			}

			if (ch === "`") {
				// End of the template: continue after the closing backtick.
				i += 1;
				return;
			}

			if (ch === "$" && code[i + 1] === "{") {
				// Entering `${ … }`: remember the depth at which its closing `}` returns to template text.
				templates.push(depth);
				depth += 1;
				i += 2;
				return;
			}

			i += 1;
		}
	}

	while (i < code.length) {
		const ch = code[i]!;

		if (ch === '"' || ch === "'") i = skipQuoteString(code, i) + 1;
		else if (ch === "`") {
			i++;
			skipToInterpolation();
		} else if (ch === "/" && code[i + 1] === "/") {
			i = code.indexOf("\n", i);
			if (i === -1) i = code.length;
		} else if (ch === "/" && code[i + 1] === "*") {
			i = code.indexOf("*/", i + 2);
			i = i === -1 ? code.length : i + 2;
		} else if (ch === "{") {
			depth++;
			i++;
		} else if (ch === "}") {
			depth--;
			i++;
			// Closing a `${ }` returns to the template text around it.
			if (templates.at(-1) === depth) {
				templates.pop();
				skipToInterpolation();
			}
		} else if (/[A-Za-z_$]/.test(ch)) {
			const start = i;
			while (i < code.length && /[\w$]/.test(code[i]!)) i++;
			// `a.b` doesn't reference `b`; `...b` does.
			const isProperty = code[start - 1] === "." && code.slice(start - 3, start) !== "...";
			if (!isProperty) names.add(code.slice(start, i));
		} else i++;
	}

	return names;
}

/**
 * The statements `body` references, directly or through other statements, in their original order.
 * Pure: needs only each statement's declared `name` (`null` declares nothing) and its `text`.
 */
export function collectReferencedStatements<T extends { name: string | null; text: string }>(
	body: string,
	statements: ReadonlyArray<T>,
): Array<T> {
	const byName = new Map<string, Array<T>>();
	for (const statement of statements) {
		if (statement.name === null) continue;
		byName.set(statement.name, [...(byName.get(statement.name) ?? []), statement]);
	}

	const found = new Set<T>();
	const queue = [body];
	while (queue.length > 0) {
		for (const name of referencedNames(queue.pop()!)) {
			for (const statement of byName.get(name) ?? []) {
				if (found.has(statement)) continue;
				found.add(statement);
				queue.push(statement.text);
			}
		}
	}

	return statements.filter((statement) => found.has(statement));
}

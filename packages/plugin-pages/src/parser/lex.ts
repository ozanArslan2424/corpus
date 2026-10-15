/**
 * Index of the quote that closes the string starting at `start`.
 * quote is whatever character sits at start
 */
export function skipQuoteString(text: string, start: number): number {
	const quote = text[start];
	for (let i = start + 1; i < text.length; i++) {
		if (text[i] === "\\") i++;
		else if (text[i] === quote) return i;
	}
	return text.length;
}

/**
 * Index of the backtick that closes the template starting at `start`
 * skipping nested `${ }` expressions.
 */
export function skipTemplateLiteral(text: string, start: number): number {
	for (let i = start + 1; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\\") i++;
		else if (ch === "`") return i;
		else if (ch === "$" && text[i + 1] === "{") {
			let depth = 0;
			for (i += 1; i < text.length; i++) {
				const inner = text[i];
				if (inner === '"' || inner === "'") i = skipQuoteString(text, i);
				else if (inner === "`") i = skipTemplateLiteral(text, i);
				else if (inner === "{") depth++;
				else if (inner === "}" && --depth === 0) break;
			}
		}
	}
	return text.length;
}

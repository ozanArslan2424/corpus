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

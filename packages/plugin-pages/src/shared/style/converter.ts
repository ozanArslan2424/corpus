interface Declaration {
	kind: "declaration";
	property: string;
	value: string;
}

interface Block {
	kind: "block";
	selector: string;
	nodes: Array<Node>;
}

type Node = Declaration | Block;

/** Splits on `separator` where it isn't inside parens, brackets or a string. */
function splitTopLevel(text: string, separator: string): Array<string> {
	const parts: Array<string> = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]!;
		if (ch === '"' || ch === "'") {
			const quote = ch;
			while (++i < text.length && text[i] !== quote) if (text[i] === "\\") i++;
		} else if (ch === "(" || ch === "[") depth++;
		else if (ch === ")" || ch === "]") depth--;
		else if (depth === 0 && ch === separator) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(text.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

function parseCss(css: string): Array<Node> {
	let index = 0;

	function parseNodes(top: boolean): Array<Node> {
		const nodes: Array<Node> = [];
		let buffer = "";
		let depth = 0;

		const flushDeclaration = (): void => {
			const text = buffer.trim();
			buffer = "";
			if (!text) return;
			const colon = text.indexOf(":");
			if (colon === -1) return;
			nodes.push({
				kind: "declaration",
				property: text.slice(0, colon).trim(),
				value: text.slice(colon + 1).trim(),
			});
		};

		while (index < css.length) {
			const ch = css[index]!;

			if (ch === "/" && css[index + 1] === "*") {
				const end = css.indexOf("*/", index + 2);
				index = end === -1 ? css.length : end + 2;
				continue;
			}
			if (ch === '"' || ch === "'") {
				const quote = ch;
				buffer += ch;
				while (++index < css.length) {
					buffer += css[index];
					if (css[index] === "\\") buffer += css[++index];
					else if (css[index] === quote) break;
				}
				index++;
				continue;
			}
			if (ch === "(") depth++;
			if (ch === ")") depth--;
			if (ch === "{" && depth === 0) {
				index++;
				const selector = buffer.trim();
				buffer = "";
				nodes.push({ kind: "block", selector, nodes: parseNodes(false) });
				continue;
			}
			if (ch === "}" && depth === 0) {
				index++;
				if (!top) {
					flushDeclaration();
					return nodes;
				}
				continue;
			}
			if (ch === ";" && depth === 0) {
				index++;
				flushDeclaration();
				continue;
			}
			buffer += ch;
			index++;
		}

		flushDeclaration();
		return nodes;
	}

	return parseNodes(true);
}

function escapeTemplate(text: string): string {
	return text.replace(/[\\`]/g, "\\$&").replace(/\$\{/g, "\\${");
}

function variableAccessor(name: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? `vars.${name}` : `vars[${JSON.stringify(name)}]`;
}

/** A value with `var(--x)` becomes a callback; anything else stays a quoted string. */
function emitValue(value: string): string {
	const pattern = /var\(\s*--([\w-]+)\s*\)/g;
	const parts: Array<string> = [];
	let last = 0;
	let found = false;

	for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
		parts.push(escapeTemplate(value.slice(last, match.index)));
		parts.push(`\${${variableAccessor(match[1]!)}}`);
		last = match.index + match[0].length;
		found = true;
	}
	parts.push(escapeTemplate(value.slice(last)));

	return found ? `(vars) => \`${parts.join("")}\`` : JSON.stringify(value);
}

/** `.a, .b` becomes a computed `select(".a", ".b")` key; a single selector stays a quoted string. */
function emitKey(selector: string): string {
	const parts = splitTopLevel(selector, ",");
	if (parts.length > 1) return `[select(${parts.map((part) => JSON.stringify(part)).join(", ")})]`;
	return JSON.stringify(parts[0] ?? selector.trim());
}

function emitNodes(nodes: Array<Node>, indent: string): string {
	const lines = nodes.map((node) =>
		node.kind === "declaration"
			? `${indent}${JSON.stringify(node.property)}: ${emitValue(node.value)},`
			: `${indent}${emitKey(node.selector)}: ${emitBlock(node.nodes, indent)},`,
	);
	return lines.join("\n");
}

function emitBlock(nodes: Array<Node>, indent: string): string {
	if (nodes.length === 0) return "{}";
	return `{\n${emitNodes(nodes, `${indent}\t`)}\n${indent}}`;
}

export function cssToStyleBlock(css: string): string {
	return `sheet(${emitBlock(parseCss(css), "")});\n`;
}

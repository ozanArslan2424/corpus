import { skipQuoteString, skipTemplateLiteral } from "@/parser/lex";
import type { Nullable } from "@/utils/is";

export interface Statement {
	/** What it is: `import`, `const`, `let`, `var`, `using`, `function`, `class`, `interface`, `type`, `enum`, `namespace`, `module`, or `export` for re-exports. `null` for plain statements. */
	keyword: Nullable<string>;
	/** The one name it declares (the local name for imports). `null` when it declares none. */
	name: Nullable<string>;
	/** Source text declaring just this name, including leading comments and modifiers like `export`. */
	text: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*/;
const MODIFIER = /^(?:export|default|declare|abstract|async)\b/;
const KIND =
	/^(?:import|const|let|var|using|function|class|interface|type|enum|namespace|module)\b\*?/;

/** Splits `text` on `separator` where it isn't nested in brackets, strings or templates. */
function splitTopLevel(text: string, separator: string): Array<string> {
	const parts: Array<string> = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"' || ch === "'") i = skipQuoteString(text, i);
		else if (ch === "`") i = skipTemplateLiteral(text, i);
		else if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
		else if (ch === ")" || ch === "]" || ch === "}" || (ch === ">" && text[i - 1] !== "=")) depth--;
		else if (depth === 0 && ch === separator) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(text.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** Names bound by a declaration target: `a`, `{ a, b: c, ...d }`, `[e, [f]]`, with defaults and type annotations. */
function bindingNames(target: string): Array<string> {
	const trimmed = target.trim();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		const close = trimmed.startsWith("{") ? "}" : "]";
		const inner = trimmed.slice(1, trimmed.lastIndexOf(close));
		return splitTopLevel(inner, ",").flatMap((element) => {
			const withoutDefault = splitTopLevel(element, "=")[0] ?? "";
			const value = trimmed.startsWith("{")
				? (splitTopLevel(withoutDefault, ":").at(-1) ?? "")
				: withoutDefault;
			return bindingNames(value.replace(/^\.\.\./, ""));
		});
	}
	const name = IDENTIFIER.exec(trimmed);
	return name ? [name[0]] : [];
}

/** The last word of `a`, `* as b`, `type c`, `d as e`: the local name. */
function localName(binding: string): string {
	return binding.trim().split(/\s+/).at(-1)!;
}

/** One `import` per local name: `import A, { b, c as d } from "x"` → `import A from "x"`, `import { b } from "x"`, … */
function importStatements(clause: string, from: string, typeOnly: boolean): Array<Statement> {
	const prefix = typeOnly ? "import type" : "import";
	return splitTopLevel(clause, ",").flatMap((part) =>
		part.startsWith("{")
			? splitTopLevel(part.slice(1, part.lastIndexOf("}")), ",").map((specifier) => ({
					keyword: "import",
					name: localName(specifier),
					text: `${prefix} { ${specifier} } from ${from};`,
				}))
			: [{ keyword: "import", name: localName(part), text: `${prefix} ${part} from ${from};` }],
	);
}

function describe(text: string): Array<Statement> {
	// Modifiers and the kind keyword are read after any leading comments.
	let code = text.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, "");
	let exported = false;
	for (let match = MODIFIER.exec(code); match; match = MODIFIER.exec(code)) {
		exported ||= match[0] === "export";
		code = code.slice(match[0].length).trimStart();
	}

	const kind = KIND.exec(code);
	if (!kind) return [{ keyword: exported ? "export" : null, name: null, text }];

	const keyword = kind[0].replace("*", "");
	const prefix = text.slice(0, text.length - code.length) + kind[0];
	code = code.slice(kind[0].length).trimStart();

	if (keyword === "import") {
		const typeOnly = /^type\s/.test(code);
		const clause = typeOnly ? code.replace(/^type\s+/, "") : code;
		const match = /^([\s\S]*?)\s+from\s*(["'][^"']*["'])/.exec(clause);
		// `import "x"` declares nothing.
		return match
			? importStatements(match[1]!, match[2]!, typeOnly)
			: [{ keyword, name: null, text }];
	}

	if (keyword === "const" || keyword === "let" || keyword === "var" || keyword === "using") {
		// One statement per declarator; a destructuring declarator is shared by each name it binds.
		return splitTopLevel(code.replace(/;\s*$/, ""), ",").flatMap((declarator) => {
			const target = splitTopLevel(declarator, "=")[0] ?? "";
			const names = bindingNames(/^[{[]/.test(target) ? target : target.split(":")[0]!);
			return names.map((name) => ({ keyword, name, text: `${prefix} ${declarator};` }));
		});
	}

	const name = IDENTIFIER.exec(code);
	return [{ keyword, name: name ? name[0] : null, text }];
}

/**
 * Imports and top-level declarations/statements of a JS or TS module, in order, one entry per declared name.
 * A statement starts on a line that begins at column 0 outside any bracket, string or template;
 * leading comments belong to the statement after them.
 */
export function topLevelStatements(source: string): Array<Statement> {
	const texts: Array<string> = [];
	let depth = 0;
	let start = 0;
	let hasCode = false;

	for (let i = 0; i < source.length; i++) {
		const ch = source[i]!;
		const lineStart = i === 0 || source[i - 1] === "\n";

		if (lineStart && depth === 0 && hasCode && /[^\s})\].?:,]/.test(ch)) {
			texts.push(source.slice(start, i));
			start = i;
			hasCode = false;
		}

		if (ch === '"' || ch === "'") i = skipQuoteString(source, i);
		else if (ch === "`") i = skipTemplateLiteral(source, i);
		else if (ch === "/" && source[i + 1] === "/") {
			const end = source.indexOf("\n", i);
			i = (end === -1 ? source.length : end) - 1;
			continue;
		} else if (ch === "/" && source[i + 1] === "*") {
			i = source.indexOf("*/", i + 2) + 1;
			continue;
		} else if (ch === "(" || ch === "[" || ch === "{") depth++;
		else if (ch === ")" || ch === "]" || ch === "}") depth--;

		if (!/\s/.test(ch)) hasCode = true;
	}
	texts.push(source.slice(start));

	return texts
		.map((text) => text.trim())
		.filter(Boolean)
		.flatMap(describe);
}

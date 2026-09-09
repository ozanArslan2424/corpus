import fs from "fs";
import path from "path";

import ts from "typescript";

import { logger } from "@/utils";
import { slugify } from "@/utils/lexical";

// const BASE_URL = "https://corpus-docs.fly.dev";

/** Framework source, the pages are generated from this. */
const SRC_DIR = path.join(process.cwd(), "src");

/** Where the markdown lands. Generated files are overwritten in place; everything else in the directory is left alone. */
const OUT_DIR = path.join(process.cwd(), "..", "docs", "src", "files");

const IGNORE = ["src/index.ts", "/C.namespace.ts", "/exports.ts", "/utils.ts", "/utils/"];

/** Document declarations a file never exports. */
const INCLUDE_INTERNALS = false;

/** Document `private` members and `_`-prefixed fields. */
const INCLUDE_PRIVATE = false;

type DocTag = { name: string; text: string };
type DocParam = { name: string; text: string };

type DocEntry = {
	/** "App" for a top level export, "App.listen" for a member. */
	qualified: string;
	/** Heading text, e.g. "App.listen()". */
	heading: string;
	kind: "class" | "interface" | "type" | "function" | "const" | "member";
	/** One block per overload. */
	signatures: Array<string>;
	description: string;
	params: Array<DocParam>;
	typeParams: Array<DocParam>;
	returns: string | null;
	throws: Array<string>;
	examples: Array<string>;
	defaults: string | null;
	deprecated: string | null;
	sees: Array<string>;
	members: Array<DocEntry>;
	/** Members are simple enough to render as a table instead of subsections. */
	tabular: boolean;
	/** Value column for enum-like consts. */
	value: string | null;
	exported: boolean;
	/** What this declaration augments — "global", a module specifier, or null. */
	augmentation: string | null;
};

type DocModule = {
	/** Path relative to the source root, e.g. "utils/path.ts". */
	rel: string;
	/** Module name from @module, falling back to the file name. */
	name: string;
	description: string;
	examples: Array<string>;
	entries: Array<DocEntry>;
};

type JsDocHost = ts.Node & { jsDoc?: Array<ts.JSDoc> };

/** Members whose docs are longer than this get their own subsection. */
const TABLE_MAX_DESCRIPTION = 200;

function getJsDocNodes(node: ts.Node): Array<ts.JSDoc> {
	return (node as JsDocHost).jsDoc ?? [];
}

/**
 * Reads a JSDoc block straight out of the source text.
 *
 * The parsed comment AST is lossy for our purposes: `{@link}` becomes nodes,
 * and `@throws {@link X} ...` has its link swallowed as a type expression.
 */
function rawDoc(jsDoc: ts.JSDoc, sf: ts.SourceFile): string {
	const slice = sf.text.slice(jsDoc.pos, jsDoc.end);
	const start = slice.indexOf("/**");
	const body = start === -1 ? slice : slice.slice(start);

	return body
		.replace(/^\/\*\*/, "")
		.replace(/\*\/\s*$/, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\* ?/, ""))
		.join("\n")
		.trim();
}

function splitTags(body: string): { description: string; tags: Array<DocTag> } {
	const lines = body.split("\n");
	const description: Array<string> = [];
	const tags: Array<DocTag> = [];
	let current: DocTag | null = null;
	let fenced = false;

	for (const line of lines) {
		if (/^\s*```/.test(line)) fenced = !fenced;

		const match = fenced ? null : line.match(/^@(\w+)[ \t]*(.*)$/);

		if (match) {
			current = { name: match[1]!, text: match[2] ?? "" };
			tags.push(current);
			continue;
		}

		if (current) current.text += `\n${line}`;
		else description.push(line);
	}

	return {
		description: description.join("\n").trim(),
		tags: tags.map((tag) => ({ name: tag.name, text: tag.text.trim() })),
	};
}

function splitNamedTag(text: string): DocParam {
	const match = text.match(/^(\[?[\w$.]+\]?)[ \t]*(?:-[ \t]*)?([\s\S]*)$/);
	if (!match) return { name: "", text };
	return { name: match[1]!.replace(/^\[|\]$/g, ""), text: (match[2] ?? "").trim() };
}

type ParsedDoc = ReturnType<typeof parseDoc>;

function parseDoc(node: ts.Node, sf: ts.SourceFile) {
	const blocks = getJsDocNodes(node);
	const bodies = blocks.map((block) => rawDoc(block, sf));
	const parsed = bodies.map(splitTags);

	const description = parsed
		.map((p) => p.description)
		.filter(Boolean)
		.join("\n\n");
	const tags = parsed.flatMap((p) => p.tags);

	const pick = (name: string) => tags.filter((tag) => tag.name === name);
	const first = (name: string) => pick(name)[0]?.text ?? null;

	return {
		hasDoc: blocks.length > 0,
		description,
		tags,
		module: first("module"),
		params: pick("param").map((tag) => splitNamedTag(tag.text)),
		typeParams: pick("typeParam").map((tag) => splitNamedTag(tag.text)),
		returns: first("returns") ?? first("return"),
		throws: pick("throws").map((tag) => tag.text),
		examples: pick("example").map((tag) => tag.text),
		defaults: first("default"),
		deprecated: first("deprecated"),
		sees: pick("see").map((tag) => tag.text),
	};
}

function emptyDoc(): ParsedDoc {
	return {
		hasDoc: false,
		description: "",
		tags: [],
		module: null,
		params: [],
		typeParams: [],
		returns: null,
		throws: [],
		examples: [],
		defaults: null,
		deprecated: null,
		sees: [],
	};
}

function declarationName(node: ts.Node): string | null {
	if (
		ts.isClassDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isEnumDeclaration(node)
	) {
		return node.name?.text ?? null;
	}
	return null;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	return ts.canHaveModifiers(node)
		? (ts.getModifiers(node) ?? []).some((mod) => mod.kind === kind)
		: false;
}

function textBetween(sf: ts.SourceFile, start: number, end: number): string {
	return sf.text
		.slice(start, end)
		.replace(/\s+/g, " ")
		.replace(/\s*([<>(),;])\s*/g, "$1")
		.replace(/([,;])(\S)/g, "$1 $2")
		.replace(/\s*\|\s*/g, " | ")
		.trim();
}

/** The declaration line, without a body or an initializer. */
function signatureOf(node: ts.Node, sf: ts.SourceFile): string {
	const start = node.getStart(sf, false);

	if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
		const brace = sf.text.indexOf("{", start);
		return textBetween(sf, start, brace === -1 ? node.end : brace);
	}

	if (
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	) {
		return textBetween(sf, start, node.body ? node.body.getStart(sf) : node.end);
	}

	if (ts.isPropertySignature(node)) {
		const end = node.end;
		return textBetween(sf, start, end)
			.replace(/[=\s]+$/, "")
			.replace(/;$/, "");
	}

	if (ts.isPropertyDeclaration(node)) {
		const end = node.initializer ? node.initializer.getStart(sf) : node.end;
		return textBetween(sf, start, end)
			.replace(/[=\s]+$/, "")
			.replace(/;$/, "");
	}

	if (ts.isVariableStatement(node)) {
		const decl = node.declarationList.declarations[0];
		const end = decl?.initializer ? decl.initializer.getStart(sf) : node.end;
		return textBetween(sf, start, end)
			.replace(/[=\s]+$/, "")
			.replace(/;$/, "");
	}

	return textBetween(sf, start, node.end).replace(/;$/, "");
}

function isCallable(node: ts.Node): boolean {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isMethodSignature(node) ||
		ts.isConstructorDeclaration(node)
	);
}

function memberName(node: ts.Node): string | null {
	const named = node as ts.NamedDeclaration;
	if (!named.name) return ts.isConstructorDeclaration(node) ? "constructor" : null;
	if (ts.isIdentifier(named.name) || ts.isStringLiteral(named.name)) return named.name.text;
	if (ts.isComputedPropertyName(named.name)) return named.name.getText().replace(/[[\]]/g, "");
	return null;
}

function objectLiteralOf(node: ts.Node): ts.ObjectLiteralExpression | null {
	if (!ts.isVariableStatement(node)) return null;
	const init = node.declarationList.declarations[0]?.initializer;
	if (!init) return null;
	if (ts.isObjectLiteralExpression(init)) return init;
	if (ts.isCallExpression(init)) {
		const arg = init.arguments[0];
		if (arg && ts.isObjectLiteralExpression(arg)) return arg;
	}
	if (ts.isAsExpression(init) && ts.isObjectLiteralExpression(init.expression)) {
		return init.expression;
	}
	return null;
}

function typeLiteralOf(node: ts.Node): ts.TypeLiteralNode | null {
	if (!ts.isTypeAliasDeclaration(node)) return null;
	return ts.isTypeLiteralNode(node.type) ? node.type : null;
}

function collectMembers(
	owner: string,
	nodes: ReadonlyArray<ts.Node>,
	sf: ts.SourceFile,
): Array<DocEntry> {
	const byName = new Map<string, Array<ts.Node>>();

	for (const node of nodes) {
		if (!INCLUDE_PRIVATE && hasModifier(node, ts.SyntaxKind.PrivateKeyword)) continue;
		const name = memberName(node);
		if (!name) continue;
		if (!INCLUDE_PRIVATE && name.startsWith("_")) continue;
		if (!getJsDocNodes(node).length && !byName.has(name)) continue;
		const list = byName.get(name) ?? [];
		list.push(node);
		byName.set(name, list);
	}

	const entries: Array<DocEntry> = [];

	for (const [name, group] of byName) {
		const documented = group.filter((node) => getJsDocNodes(node).length > 0);
		if (documented.length === 0) continue;

		const doc = documented
			.map((node) => parseDoc(node, sf))
			.reduce((acc, next) => mergeDocs(acc, next), emptyDoc());

		const callable = group.some(isCallable);
		const value = objectValueOf(group[0]!, sf);

		entries.push({
			qualified: `${owner}.${name}`,
			heading: `${owner}.${name}${callable ? "()" : ""}`,
			kind: "member",
			signatures: group.map((node) => signatureOf(node, sf)),
			description: doc.description,
			params: doc.params,
			typeParams: doc.typeParams,
			returns: doc.returns,
			throws: doc.throws,
			examples: doc.examples,
			defaults: doc.defaults,
			deprecated: doc.deprecated,
			sees: doc.sees,
			members: [],
			tabular: false,
			value,
			exported: true,
			augmentation: null,
		});
	}

	return entries;
}

function objectValueOf(node: ts.Node, sf: ts.SourceFile): string | null {
	if (ts.isPropertyAssignment(node))
		return textBetween(sf, node.initializer.getStart(sf), node.end);
	return null;
}

function mergeDocs(a: ParsedDoc, b: ParsedDoc): ParsedDoc {
	return {
		hasDoc: a.hasDoc || b.hasDoc,
		description: [a.description, b.description].filter(Boolean).join("\n\n"),
		tags: [...a.tags, ...b.tags],
		module: a.module ?? b.module,
		params: a.params.length ? a.params : b.params,
		typeParams: a.typeParams.length ? a.typeParams : b.typeParams,
		returns: a.returns ?? b.returns,
		throws: [...a.throws, ...b.throws],
		examples: [...a.examples, ...b.examples],
		defaults: a.defaults ?? b.defaults,
		deprecated: a.deprecated ?? b.deprecated,
		sees: [...a.sees, ...b.sees],
	};
}

function canTabulate(members: Array<DocEntry>): boolean {
	if (members.length === 0) return false;
	return members.every(
		(member) =>
			!member.heading.endsWith("()") &&
			member.params.length === 0 &&
			member.returns === null &&
			member.examples.length === 0 &&
			!member.description.includes("\n\n") &&
			member.description.length <= TABLE_MAX_DESCRIPTION,
	);
}

function augmentationTarget(node: ts.ModuleDeclaration): string {
	if (ts.isStringLiteral(node.name)) return node.name.text;
	if (node.flags & ts.NodeFlags.GlobalAugmentation) return "global";
	return node.name.text;
}

/**
 * Interfaces declared inside `declare global` / `declare module` blocks.
 *
 * These describe what the module bolts onto types it does not own, so they are
 * emitted ahead of the exports: the patched `Headers` surface is the thing a
 * reader needs before anything that writes to it makes sense.
 */
function collectAugmentations(sf: ts.SourceFile): Array<DocEntry> {
	const entries: Array<DocEntry> = [];

	for (const statement of sf.statements) {
		if (!ts.isModuleDeclaration(statement)) continue;

		const body = statement.body;
		if (!body || !ts.isModuleBlock(body)) continue;

		const target = augmentationTarget(statement);

		for (const inner of body.statements) {
			if (!ts.isInterfaceDeclaration(inner) && !ts.isTypeAliasDeclaration(inner)) continue;

			const name = declarationName(inner);
			if (!name) continue;

			const doc = parseDoc(inner, sf);

			const memberNodes: Array<ts.Node> = [];
			if (ts.isInterfaceDeclaration(inner)) memberNodes.push(...inner.members);
			const typeLiteral = typeLiteralOf(inner);
			if (typeLiteral) memberNodes.push(...typeLiteral.members);

			const members = collectMembers(name, memberNodes, sf);
			if (!doc.hasDoc && members.length === 0) continue;

			entries.push({
				qualified: name,
				heading: name,
				kind: ts.isInterfaceDeclaration(inner) ? "interface" : "type",
				signatures: [signatureOf(inner, sf)],
				description: doc.description,
				params: doc.params,
				typeParams: doc.typeParams,
				returns: doc.returns,
				throws: doc.throws,
				examples: doc.examples,
				defaults: doc.defaults,
				deprecated: doc.deprecated,
				sees: doc.sees,
				members,
				tabular: canTabulate(members),
				value: null,
				exported: false,
				augmentation: target,
			});
		}
	}

	return entries;
}

/** Names in the order their `export { ... }` statement lists them. */
function exportOrder(sf: ts.SourceFile): Array<string> {
	const order: Array<string> = [];

	for (const statement of sf.statements) {
		if (ts.isExportDeclaration(statement)) {
			if (statement.moduleSpecifier) continue;
			const clause = statement.exportClause;
			if (!clause || !ts.isNamedExports(clause)) continue;
			for (const element of clause.elements) {
				const name = (element.propertyName ?? element.name).text;
				if (!order.includes(name)) order.push(name);
			}
			continue;
		}

		if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;

		if (ts.isVariableStatement(statement)) {
			for (const decl of statement.declarationList.declarations) {
				if (ts.isIdentifier(decl.name) && !order.includes(decl.name.text)) {
					order.push(decl.name.text);
				}
			}
			continue;
		}

		const name = declarationName(statement);
		if (name && !order.includes(name)) order.push(name);
	}

	return order;
}

function entryKind(node: ts.Node): DocEntry["kind"] {
	if (ts.isClassDeclaration(node)) return "class";
	if (ts.isInterfaceDeclaration(node)) return "interface";
	if (ts.isTypeAliasDeclaration(node)) return "type";
	if (ts.isFunctionDeclaration(node)) return "function";
	return "const";
}

export function extractModule(absPath: string, rel: string): DocModule {
	const text = fs.readFileSync(absPath, "utf8");
	const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

	const declarations = new Map<string, Array<ts.Node>>();
	const declaredOrder: Array<string> = [];
	let moduleDoc: ParsedDoc | null = null;
	let moduleDocNode: ts.Node | null = null;

	for (const statement of sf.statements) {
		for (const block of getJsDocNodes(statement)) {
			const parsed = splitTags(rawDoc(block, sf));
			const isModuleBlock = parsed.tags.some((tag) => tag.name === "module");
			if (isModuleBlock && !moduleDoc) {
				moduleDoc = {
					...emptyDoc(),
					hasDoc: true,
					description: parsed.description,
					tags: parsed.tags,
					module: parsed.tags.find((tag) => tag.name === "module")?.text ?? null,
					examples: parsed.tags.filter((tag) => tag.name === "example").map((tag) => tag.text),
				};
				moduleDocNode = statement;
			}
		}

		const names: Array<string> = [];

		if (ts.isVariableStatement(statement)) {
			for (const decl of statement.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) names.push(decl.name.text);
			}
		} else {
			const name = declarationName(statement);
			if (name) names.push(name);
		}

		for (const name of names) {
			const list = declarations.get(name) ?? [];
			list.push(statement);
			declarations.set(name, list);
			if (!declaredOrder.includes(name)) declaredOrder.push(name);
		}
	}

	const exported = exportOrder(sf);
	const names = INCLUDE_INTERNALS
		? [...exported, ...declaredOrder.filter((name) => !exported.includes(name))]
		: exported;

	// Augmentations first, then the exports in the order the file lists them.
	const entries: Array<DocEntry> = collectAugmentations(sf);

	for (const name of names) {
		const group = declarations.get(name);
		if (!group || group.length === 0) continue;

		const documented = group.filter(
			(node) => getJsDocNodes(node).length > 0 && node !== moduleDocNode,
		);
		if (documented.length === 0) continue;

		const doc = documented
			.map((node) => parseDoc(node, sf))
			.reduce((acc, next) => mergeDocs(acc, next), emptyDoc());

		const memberNodes: Array<ts.Node> = [];
		for (const node of group) {
			if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
				memberNodes.push(...node.members);
			}
			const literal = objectLiteralOf(node);
			if (literal) memberNodes.push(...literal.properties);
			const typeLiteral = typeLiteralOf(node);
			if (typeLiteral) memberNodes.push(...typeLiteral.members);
		}

		const members = collectMembers(name, memberNodes, sf);
		const isEnumLike = group.some((node) => objectLiteralOf(node) !== null);

		entries.push({
			qualified: name,
			heading: name,
			kind: entryKind(group[0]!),
			signatures: group.map((node) => signatureOf(node, sf)),
			description: doc.description,
			params: doc.params,
			typeParams: doc.typeParams,
			returns: doc.returns,
			throws: doc.throws,
			examples: doc.examples,
			defaults: doc.defaults,
			deprecated: doc.deprecated,
			sees: doc.sees,
			members,
			tabular: isEnumLike || canTabulate(members),
			value: null,
			exported: exported.includes(name),
			augmentation: null,
		});
	}

	return {
		rel,
		name: moduleDoc?.module?.trim() || path.parse(rel).name,
		description: moduleDoc?.description ?? "",
		examples: moduleDoc?.examples ?? [],
		entries,
	};
}

function walkSources(dir: string, ignore: Array<string>): Array<string> {
	const out: Array<string> = [];

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		if (ignore.some((pattern) => abs.includes(pattern))) continue;
		if (entry.isDirectory()) {
			out.push(...walkSources(abs, ignore));
			continue;
		}
		if (!entry.name.endsWith(".ts")) continue;
		if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".d.ts")) continue;
		out.push(abs);
	}

	return out.sort();
}

/** A generated file path relative to the output root, e.g. "utils/path.md". */
type LinkTarget = { file: string; anchor: string | null };
type LinkIndex = Map<string, LinkTarget>;

/**
 * Every name a `{@link}` may point at, mapped to where it lives.
 *
 * Names that appear in more than one module are dropped rather than pointing at
 * whichever module happened to be indexed last.
 */
export function buildLinkIndex(modules: Array<DocModule>): LinkIndex {
	const index: LinkIndex = new Map();
	const ambiguous = new Set<string>();

	const add = (key: string, target: LinkTarget) => {
		if (index.has(key)) {
			ambiguous.add(key);
			return;
		}
		index.set(key, target);
	};

	for (const mod of modules) {
		const file = fileOf(mod.rel);
		add(mod.name, { file, anchor: null });

		for (const entry of mod.entries) {
			add(entry.qualified, { file, anchor: slugify(entry.heading) });
			for (const member of entry.members) {
				add(member.qualified, { file, anchor: slugify(member.heading) });
			}
		}
	}

	for (const key of ambiguous) index.delete(key);
	return index;
}

function relativeHref(from: string, target: LinkTarget): string {
	if (target.file === from) return target.anchor ? `#${target.anchor}` : "#";

	const fromDir = path.posix.dirname(from);
	let href = path.posix.relative(fromDir, target.file);
	if (!href.startsWith(".")) href = `./${href}`;

	return target.anchor ? `${href}#${target.anchor}` : href;
}

type ResolveResult = { text: string; unresolved: Array<string> };

/**
 * Rewrites `{@link Target}` and `{@link Target label}` into markdown links,
 * relative to the file being rendered. Unknown targets fall back to inline code
 * so a stale reference degrades instead of becoming a dead link.
 */
function resolveLinks(text: string, index: LinkIndex, from: string): ResolveResult {
	const unresolved: Array<string> = [];

	const out = text.replace(
		/\{@link\s+([^\s}|]+)(?:[\s|]+([^}]*))?\}/g,
		(_match, rawTarget, rawLabel) => {
			const target = String(rawTarget).replace(/[()]/g, "");
			const label = (rawLabel ? String(rawLabel) : "").trim() || target;
			const found = index.get(target);

			if (!found) {
				unresolved.push(target);
				return `\`${label}\``;
			}

			return `[${label}](${relativeHref(from, found)})`;
		},
	);

	return { text: out, unresolved };
}

function fence(code: string, lang = "ts"): string {
	return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function paramList(label: string, params: Array<{ name: string; text: string }>): Array<string> {
	if (params.length === 0) return [];
	const items = params.map((param) => {
		const text = param.text ? ` — ${param.text.replace(/\n+/g, " ")}` : "";
		return `- \`${param.name}\`${text}`;
	});
	return [`**${label}**`, "", ...items, ""];
}

function tableRow(cells: Array<string>): string {
	return `| ${cells.join(" | ")} |`;
}

function escapeCell(text: string): string {
	return text.replace(/\n+/g, " ").replace(/\|/g, "\\|").trim();
}

function renderMemberTable(entry: DocEntry): Array<string> {
	const hasValue = entry.members.some((member) => member.value !== null);
	const header = hasValue ? ["Name", "Value", "Description"] : ["Name", "Description"];
	const divider = header.map(() => "---");

	const rows = entry.members.map((member) => {
		const name = `\`${member.qualified.split(".").slice(1).join(".")}\``;
		const description = escapeCell(member.description);
		return hasValue
			? tableRow([name, `\`${escapeCell(member.value ?? "")}\``, description])
			: tableRow([name, description]);
	});

	return ["", tableRow(header), tableRow(divider), ...rows, ""];
}

function renderBody(entry: DocEntry, level: number): Array<string> {
	const lines: Array<string> = [];

	if (entry.deprecated !== null) {
		lines.push(`> **Deprecated.** ${entry.deprecated || "This API will be removed."}`, "");
	}

	if (entry.signatures.length > 0) lines.push(fence(entry.signatures.join("\n")), "");
	if (entry.description) lines.push(entry.description, "");

	lines.push(...paramList("Type parameters", entry.typeParams));
	lines.push(...paramList("Parameters", entry.params));

	if (entry.returns) lines.push(`**Returns** — ${entry.returns.replace(/\n+/g, " ")}`, "");

	for (const thrown of entry.throws) {
		lines.push(`**Throws** — ${thrown.replace(/\n+/g, " ")}`, "");
	}

	if (entry.defaults) lines.push(`**Default** — ${entry.defaults.replace(/\n+/g, " ")}`, "");

	for (const example of entry.examples) {
		lines.push(example.includes("```") ? example : fence(example), "");
	}

	for (const see of entry.sees) lines.push(`See ${see}`, "");

	if (entry.members.length > 0) {
		if (entry.tabular) {
			lines.push(...renderMemberTable(entry));
		} else {
			for (const member of entry.members) {
				lines.push(`${"#".repeat(level + 1)} ${member.heading}`, "");
				lines.push(...renderBody(member, level + 1));
			}
		}
	}

	return lines;
}

const KIND_LABEL: Record<DocEntry["kind"], string> = {
	class: "class",
	interface: "interface",
	type: "type",
	function: "function",
	const: "const",
	member: "member",
};

function renderTableOfContents(entries: Array<DocEntry>): Array<string> {
	if (entries.length === 0) return [];

	const items = entries.map(
		(entry, i) => `${i + 1}. [${entry.heading}](#${slugify(entry.heading)})`,
	);

	return [
		`<section class="table-of-contents">`,
		"",
		`##### Contents`,
		"",
		...items,
		"",
		`</section>`,
		"",
	];
}

function renderModule(module: DocModule): string {
	const lines: Array<string> = [`# ${module.name}`, ""];

	if (module.description) lines.push(module.description, "");
	for (const example of module.examples) {
		lines.push(example.includes("```") ? example : fence(example), "");
	}

	lines.push(...renderTableOfContents(module.entries));

	for (const entry of module.entries) {
		const suffix = entry.augmentation
			? ` — augments \`${entry.augmentation}\``
			: entry.exported
				? ""
				: " *(internal)*";
		lines.push(`## ${entry.heading}`, "");
		lines.push(`*${KIND_LABEL[entry.kind]}*${suffix}`, "");
		lines.push(...renderBody(entry, 2));
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()}\n`;
}

/** Mirrors the source tree: src/utils/path.ts becomes utils/path.md. */
function fileOf(rel: string): string {
	const parsed = path.parse(rel);
	return path.posix.join(parsed.dir.split(path.sep).join("/"), `${parsed.name}.md`);
}

function reportUnresolved(unresolved: Array<string>): void {
	if (unresolved.length === 0) return;

	const counts = new Map<string, number>();
	for (const name of unresolved) counts.set(name, (counts.get(name) ?? 0) + 1);

	const report = Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([name, count]) => `${name} (${count})`);

	logger.warn("unresolved {@link} targets:");
	for (const line of report) {
		logger.info(line);
	}
}

function generate(): Array<string> {
	const modules = walkSources(SRC_DIR, IGNORE)
		.map((abs) => extractModule(abs, path.relative(SRC_DIR, abs)))
		.filter((module) => module.entries.length > 0 || module.description.length > 0);

	const index = buildLinkIndex(modules);
	const unresolved: Array<string> = [];
	const written: Array<string> = [];

	for (const mod of modules) {
		const file = fileOf(mod.rel);
		const resolved = resolveLinks(renderModule(mod), index, file);
		unresolved.push(...resolved.unresolved);

		const outPath = path.join(OUT_DIR, file);
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, resolved.text);
		written.push(file);
	}

	reportUnresolved(unresolved);
	console.log(`generated ${written.length} pages in ${OUT_DIR}`);

	return written;
}

generate();

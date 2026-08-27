import fs from "fs/promises";
import path from "path";

import ts from "typescript";

import { arrIncludes, createSafeObject, isEmpty } from "@/utils";

const DOCS_MD_EXT = ".docs.md";
const SECTIONS = ["extends", "usage", "parameters", "properties"] as const;

type SectionKey = (typeof SECTIONS)[number];

interface Section {
	intro: string;
	items: Record<string, string>;
}

interface DocNode {
	doc: string;
	sections: Partial<Record<SectionKey, Section>>;
}

type DocMap = Record<string, DocNode>;

interface Insertion {
	pos: number;
	text: string;
}

function getOwn<T>(dict: Record<string, T>, key: string): T | undefined {
	return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
}

function stripFrontmatter(md: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(md);
	return match ? md.slice(match[0].length) : md;
}

function parseDocsMarkdown(raw: string): DocMap {
	const md = stripFrontmatter(raw);
	const lines = md.split(/\r?\n/);
	const docMap = createSafeObject<DocMap>();

	let currentTop: string | null = null;
	let inIntro = true;
	let currentSectionKey: SectionKey | null = null;
	let currentItemTitle: string | null = null;
	let buffer: Array<string> = [];

	function flush() {
		const text = buffer.join("\n").trim();
		buffer = [];
		if (!text || currentTop === null) return;

		const entry = getOwn(docMap, currentTop);
		if (!entry) return;

		if (inIntro) {
			entry.doc = text;
			return;
		}
		if (!currentSectionKey) return;

		const section =
			getOwn(entry.sections, currentSectionKey) ??
			(entry.sections[currentSectionKey] = { intro: "", items: createSafeObject() });
		if (currentItemTitle) {
			section.items[currentItemTitle] = text;
		} else {
			section.intro = text;
		}
	}

	for (const line of lines) {
		const h1 = /^#\s+(.+)$/.exec(line);
		const h2 = /^##\s+(.+)$/.exec(line);
		const h3 = /^###\s+(.+)$/.exec(line);

		if (h1) {
			flush();
			currentTop = h1[1]!.trim();
			inIntro = true;
			currentSectionKey = null;
			currentItemTitle = null;
			docMap[currentTop] = {
				doc: "",
				sections: createSafeObject<Partial<Record<SectionKey, Section>>>(),
			};
			continue;
		}

		if (h2 && currentTop) {
			flush();
			inIntro = false;
			currentItemTitle = null;
			const key = h2[1]!.trim().toLowerCase();
			currentSectionKey = arrIncludes(key, SECTIONS) ? key : null;
			continue;
		}

		if (h3 && currentTop) {
			flush();
			currentItemTitle = h3[1]!.trim();
			continue;
		}
		buffer.push(line);
	}
	flush();
	return docMap;
}

function buildTopLevelDoc(entry: DocNode): string {
	const parts: Array<string> = [];
	if (entry.doc) parts.push(entry.doc);

	const extends_ = entry.sections.extends;
	if (extends_?.intro) parts.push(extends_.intro);

	const usage = entry.sections.usage;
	if (usage) {
		if (usage.intro) parts.push(usage.intro);
		for (const [title, content] of Object.entries(usage.items)) {
			parts.push(`@example\n${title ? `**${title}**\n` : ""}${content}`);
		}
	}
	return parts.join("\n\n");
}

function buildParamsDoc(entry: DocNode, paramNames: Array<string>): string {
	const params = entry.sections.parameters;
	if (!params) return "";
	const parts: Array<string> = [];
	if (params.intro) parts.push(params.intro);
	for (const name of paramNames) {
		const desc = getOwn(params.items, name);
		if (desc) parts.push(`@param ${name} ${desc}`);
	}
	return parts.join("\n");
}

function toJsDoc(text: string, indent: string): string {
	const body = text
		.split("\n")
		.map((l) => `${indent} * ${l}`.trimEnd())
		.join("\n");
	return `${indent}/**\n${body}\n${indent} */\n`;
}

function getParamName(p: ts.ParameterDeclaration): string | undefined {
	return ts.isIdentifier(p.name) ? p.name.text : undefined;
}

function isString(x: string | undefined): x is string {
	return typeof x === "string";
}

function getName(node: ts.Node): string | undefined {
	if (
		ts.isClassDeclaration(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node)
	) {
		return node.name?.text;
	}
	if (ts.isVariableStatement(node)) {
		const decl = node.declarationList.declarations[0];
		if (decl && ts.isIdentifier(decl.name)) return decl.name.text;
	}
	return undefined;
}

function getMemberName(member: ts.ClassElement | ts.TypeElement): string | undefined {
	if (ts.isConstructorDeclaration(member)) return "constructor";
	if (
		(ts.isMethodDeclaration(member) ||
			ts.isPropertyDeclaration(member) ||
			ts.isGetAccessorDeclaration(member) ||
			ts.isSetAccessorDeclaration(member) ||
			ts.isPropertySignature(member) ||
			ts.isMethodSignature(member)) &&
		member.name &&
		ts.isIdentifier(member.name)
	) {
		return member.name.text;
	}
	return undefined;
}

async function injectDocsIntoDts(dtsPath: string, docs: DocMap) {
	const source = await fs.readFile(dtsPath, "utf8");
	const sourceFile = ts.createSourceFile(
		dtsPath,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	const insertions: Array<Insertion> = [];

	function getLineStart(pos: number): number {
		const lc = sourceFile.getLineAndCharacterOfPosition(pos);
		return sourceFile.getPositionOfLineAndCharacter(lc.line, 0);
	}

	function getInsertInfo(node: ts.Node): { pos: number; indent: string } {
		const fullStart = node.getFullStart();
		const commentRanges = ts.getLeadingCommentRanges(source, fullStart);
		const anchor =
			commentRanges && commentRanges.length > 0
				? commentRanges[0]!.pos
				: node.getStart(sourceFile, false);
		const pos = getLineStart(anchor);
		const indent = source.slice(pos, anchor);
		return { pos, indent };
	}

	function addInsertion(node: ts.Node, docText: string) {
		if (isEmpty(docText)) return;
		const { pos, indent } = getInsertInfo(node);
		insertions.push({ pos, text: toJsDoc(docText, indent) });
	}

	for (const stmt of sourceFile.statements) {
		const name = getName(stmt);
		if (!name) continue;

		const entry = getOwn(docs, name);
		if (!entry) continue;

		if (ts.isFunctionDeclaration(stmt)) {
			const paramNames = stmt.parameters.map(getParamName).filter(isString);
			const combined = [buildTopLevelDoc(entry), buildParamsDoc(entry, paramNames)]
				.filter(Boolean)
				.join("\n\n");
			addInsertion(stmt, combined);
			continue;
		}

		addInsertion(stmt, buildTopLevelDoc(entry));

		if (ts.isClassDeclaration(stmt)) {
			const ctor = stmt.members.find(ts.isConstructorDeclaration);
			if (ctor) {
				const paramNames = ctor.parameters.map(getParamName).filter(isString);
				const paramsDoc = buildParamsDoc(entry, paramNames);
				if (paramsDoc) addInsertion(ctor, paramsDoc);
			}
		}

		if (
			(ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) &&
			entry.sections.properties
		) {
			const propsSection = entry.sections.properties;
			for (const member of stmt.members) {
				const memberName = getMemberName(member);
				if (!memberName) continue;
				const memberDoc = getOwn(propsSection.items, memberName);
				if (memberDoc) addInsertion(member, memberDoc);
			}
		}
	}

	if (insertions.length === 0) return;

	insertions.sort((a, b) => b.pos - a.pos);
	let result = source;
	for (const ins of insertions) {
		result = result.slice(0, ins.pos) + ins.text + result.slice(ins.pos);
	}
	await fs.writeFile(dtsPath, result, "utf8");
}

async function walkDtsFiles(dir: string): Promise<Array<string>> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files: Array<string> = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkDtsFiles(full)));
		} else if (entry.name.endsWith(".d.ts")) {
			files.push(full);
		}
	}
	return files;
}

export async function injectDocs(srcDir: string, distDir: string) {
	const dtsFiles = await walkDtsFiles(distDir);
	for (const dtsFile of dtsFiles) {
		const rel = path.relative(distDir, dtsFile);
		const mdPath = path.join(srcDir, rel.replace(/\.d\.ts$/, DOCS_MD_EXT));
		const exists = await fs.exists(mdPath);
		if (!exists) continue;
		const docs = parseDocsMarkdown(await fs.readFile(mdPath, "utf8"));
		await injectDocsIntoDts(dtsFile, docs);
	}
}

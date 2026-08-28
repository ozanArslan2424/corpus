import fs from "fs/promises";
import path from "path";

import type * as oxc from "oxc-parser";

import {
	isEmpty,
	isNil,
	isNull,
	isUndefined,
	StringReader,
	type Maybe,
	type Nullable,
} from "@/utils";
import { FileParser } from "@/utils/FileParser";

import { replaceMarkdownLinks } from "./replaceMarkdownLinks";

type SectionKind = "plain" | "example" | "param" | "property" | "extends";

interface Section {
	id: string;
	kind: SectionKind;
	parent: string;
	title: string;
	lines: Array<string>;
	extendsName?: string;
}

interface Insertion {
	line: number;
	jsdoc: string;
}

const DOCS_MD_EXT = ".docs.md";

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

async function readDocsFile(
	srcdir: string,
	outdir: string,
	dtsFile: string,
): Promise<Nullable<string>> {
	const rel = path.relative(outdir, dtsFile);
	const mdPath = path.join(srcdir, rel.replace(/\.d\.ts$/, DOCS_MD_EXT));
	const exists = await fs.exists(mdPath);
	if (!exists) return null;
	return await fs.readFile(mdPath, "utf8");
}

function splitFrontMatter(md: string): { frontmatter: string; content: string } {
	const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(md);
	return {
		frontmatter: match?.[0] ?? "",
		content: match ? md.slice(match[0].length) : md,
	};
}

function splitSections(md: string) {
	const lines = md.split("\n");
	const sections: Array<Section> = [];

	let currentSection: Nullable<Section> = null;
	let currentH1 = "";
	let currentH2 = "";
	let currentH3 = "";

	function newSection(parent: string, title: string, kind: SectionKind): Section {
		return {
			id: currentH1,
			parent,
			title,
			kind,
			lines: [],
			extendsName: undefined,
		};
	}

	for (const line of lines) {
		try {
			if (isEmpty(line)) {
				continue;
			}

			const h1 = /^#\s+(.+)$/.exec(line)?.[1];
			if (!isEmpty(h1)) {
				currentH1 = h1;
				currentSection = newSection("", h1, "plain");
				sections.push(currentSection);
				continue;
			}

			const h2 = /^##\s+(.+)$/.exec(line)?.[1];
			if (!isEmpty(h2)) {
				currentH2 = h2;
				let kind: SectionKind = "plain";
				if (/^[Ee]xtend(?:s|ing)/.test(h2)) {
					kind = "extends";
				}
				currentSection = newSection(currentH1, h2, kind);
				if (kind === "extends") {
					currentSection.extendsName = /[Ee]xtend(?:s|ing)\s*(.*)/.exec(h2)?.[1];
				}
				sections.push(currentSection);
				continue;
			}

			const h3 = /^###\s+(.+)$/.exec(line)?.[1];
			if (!isEmpty(h3)) {
				currentH3 = h3;
				let kind: SectionKind = "example";
				if (/^[Pp]ropert(?:y|ies)/.test(currentH2)) {
					kind = "property";
				}
				if (/^[Pp]aram(?:s|eters)/.test(currentH2)) {
					kind = "param";
				}
				currentSection = newSection(currentH2, h3, kind);
				sections.push(currentSection);
				continue;
			}

			const h4 = /^####\s+(.+)$/.exec(line)?.[1];
			if (!isEmpty(h4)) {
				let kind: SectionKind = "example";
				if (/^[Pp]ropert(?:y|ies)/.test(currentH2)) {
					kind = "property";
				}
				if (/^[Pp]aram(?:s|eters)/.test(currentH2)) {
					kind = "param";
				}
				currentSection = newSection(currentH3, h4, kind);
				sections.push(currentSection);
				continue;
			}

			if (!isNull(currentSection)) {
				currentSection.lines.push(line);
			}
		} catch (err) {
			console.log("Error in line:");
			console.log(line);
			console.log(String(err));
		}
	}
	return sections;
}

function countChars(str: string, char: string): number {
	return str.split(char).length - 1;
}

function getIndentLevel(line: string): number {
	let level = 0;
	while (line[level] === "\t") {
		level++;
	}
	return level;
}

function toJsdoc(indentLevel: number, sections: Array<Section>) {
	const indent = "\t".repeat(indentLevel);
	const tagged = sections.map(tagExample).map(tagExtends);
	const nonEmpty = tagged.filter((s) => s.lines.length > 0);
	const lines = nonEmpty.flatMap((s, i) => (i === 0 ? s.lines : ["", ...s.lines]));
	return lines.length === 1
		? `${indent}/** ${lines[0]} */\n`
		: `${indent}/**\n${lines.map((l) => `${indent} * ${l}`.trimEnd()).join("\n")}\n${indent} */\n`;
}

function tagExample(section: Section): Section {
	return section.kind === "example"
		? { ...section, lines: ["@example", ...section.lines] }
		: section;
}

function tagExtends(section: Section): Section {
	if (isUndefined(section.extendsName)) return section;
	const extendsLines = section.extendsName.split(",").map((name) => `@extends ${name.trim()}`);
	return { ...section, lines: [...extendsLines, ...section.lines] };
}

function getParamName(param: oxc.ParamPattern): Nullable<string> {
	switch (param?.type) {
		case "Identifier":
			return param.name;
		case "AssignmentPattern":
			return getParamName(param.left);
		case "RestElement":
			return getParamName(param.argument);
		case "TSParameterProperty":
			return getParamName(param.parameter);
		default:
			return null;
	}
}

async function injectDocsIntoDts(dtsFile: string, sections: Array<Section>) {
	const parser = new FileParser(dtsFile);
	const insertions: Array<Insertion> = [];

	function getSections(id: string, kind: SectionKind): Array<Section> {
		const section = sections.find((s) => s.id === id && s.kind === kind);
		if (isNil(section)) return [];
		const subSections = sections.filter((s) => s.parent === id && s.kind === kind);
		const examples = sections.filter(
			(s) =>
				s.kind === "example" &&
				(s.parent === id || subSections.some((sub) => sub.title === s.parent)),
		);
		const combined = Array.from(new Set([section, ...subSections, ...examples])); // dedupe
		return combined;
	}

	function getSubSections(title: string, kind: SectionKind): Array<Section> {
		const section = sections.find((s) => s.title === title && s.kind === kind);
		if (isNil(section)) return [];
		const examples = sections.filter((s) => s.kind === "example" && s.parent === title);
		return [section, ...examples];
	}

	function addInsertion(line: number, jsdoc: string) {
		insertions.push({ line, jsdoc });
	}

	async function writeInsertions() {
		if (insertions.length === 0) return;
		insertions.sort((a, b) => b.line - a.line);
		const lines = parser.contents.split("\n");
		for (const ins of insertions) {
			let jsdoc = ins.jsdoc;
			jsdoc = replaceMarkdownLinks(jsdoc, (label, url) =>
				countChars(url, "/") > 1 ? `[${label}](${url})` : `{@link ${url.replace("/", "")}}`,
			);
			jsdoc = jsdoc.replace(/\n$/, "");
			lines.splice(ins.line, 0, jsdoc);
		}
		const result = lines.join("\n");
		await fs.writeFile(dtsFile, result, "utf8");
	}

	function injectParamDocs(params: Array<oxc.ParamPattern>, reader: StringReader) {
		for (const param of params) {
			const name = getParamName(param);
			if (!name) continue;
			const paramSections = getSubSections(name, "param");
			if (!paramSections.length) continue;
			const line = reader.getLineOfCharIndex(param.start);
			const indent = getIndentLevel(line);
			const jsdoc = toJsdoc(indent, paramSections);
			const lineNumber = reader.getLineNumber(line);
			addInsertion(lineNumber, jsdoc);
		}
	}

	function injectTypeLiteralPropertyDocs(typeLiteral: Maybe<oxc.TSType>, reader: StringReader) {
		if (isNil(typeLiteral)) return;
		if (typeLiteral.type !== "TSTypeLiteral") return;
		for (const member of typeLiteral.members) {
			if (member.type !== "TSPropertySignature") continue;
			const name = parser.getNodeTextContent(member.key);
			const propSections = getSubSections(name, "property");
			if (!propSections.length) continue;
			const line = reader.getLineOfCharIndex(member.start);
			const indent = getIndentLevel(line);
			const jsdoc = toJsdoc(indent, propSections);
			const lineNumber = reader.getLineNumber(line);
			addInsertion(lineNumber, jsdoc);
		}
	}

	function injectClassDeclarationDocs(node: oxc.Class, reader: StringReader) {
		const title = node.id?.name;
		if (!title) return;
		const sections = getSections(title, "plain");
		const extendsSections = getSections(title, "extends");
		if (!sections.length) return;
		const line = reader.getLineOfCharIndex(node.start);
		const indent = getIndentLevel(line);
		const jsdocSections = [...sections];
		// no need to decipher all this through the parser,
		// just write correct documentation...
		jsdocSections.push(...extendsSections);
		const jsdoc = toJsdoc(indent, jsdocSections);
		const lineNumber = reader.getLineNumber(line);
		addInsertion(lineNumber, jsdoc);

		for (const member of node.body.body) {
			const isConstructor = member.type === "MethodDefinition" && member.kind === "constructor";
			if (!isConstructor) continue;
			injectParamDocs(member.value.params, reader);
		}
	}

	function injectPropertyDefinitionDocs(node: oxc.PropertyDefinition, reader: StringReader) {
		const title = parser.getNodeTextContent(node.key);
		const sections = getSubSections(title, "property");
		if (!sections.length) return;
		const line = reader.getLineOfCharIndex(node.start);
		const indent = getIndentLevel(line);
		const jsdoc = toJsdoc(indent, sections);
		const lineNumber = reader.getLineNumber(line);
		addInsertion(lineNumber, jsdoc);
	}

	function injectExportNamedDeclarationDocs(
		node: oxc.ExportNamedDeclaration,
		reader: StringReader,
	) {
		let title: Nullable<string> = null;
		if (!node.declaration) return;
		switch (node.declaration.type) {
			case "VariableDeclaration": {
				const id = node.declaration.declarations[0]?.id;
				title = id?.type === "Identifier" ? id.name : null;
				const typeAnnotation = id?.type === "Identifier" ? id.typeAnnotation?.typeAnnotation : null;
				injectTypeLiteralPropertyDocs(typeAnnotation, reader);
				break;
			}
			case "FunctionDeclaration":
			case "FunctionExpression":
			case "TSDeclareFunction":
			case "TSEmptyBodyFunctionExpression":
			case "TSImportEqualsDeclaration":
			case "TSInterfaceDeclaration":
			case "TSTypeAliasDeclaration":
			case "TSEnumDeclaration":
			case "ClassExpression":
				title = node.declaration.id?.name ?? null;
				break;
			case "TSModuleDeclaration":
				break;
			case "ClassDeclaration":
				// handled separately
				title = null;
				break;
		}

		if (!title) return;
		const sections = getSections(title, "plain");
		if (!sections.length) return;
		const line = reader.getLineOfCharIndex(node.start);
		const indent = getIndentLevel(line);
		const jsdoc = toJsdoc(indent, sections);
		const lineNumber = reader.getLineNumber(line);
		addInsertion(lineNumber, jsdoc);

		// easier to check for params existance, type narrows correctly
		if ("params" in node.declaration) {
			injectParamDocs(node.declaration.params, reader);
		}
	}

	parser.runCallback((node, reader) => {
		if (node.type === "ClassDeclaration") {
			injectClassDeclarationDocs(node, reader);
		}

		if (node.type === "PropertyDefinition") {
			injectPropertyDefinitionDocs(node, reader);
		}

		if (node.type === "ExportNamedDeclaration") {
			injectExportNamedDeclarationDocs(node, reader);
		}
	});

	await writeInsertions();
}

export async function injectDocs(srcdir: string, outdir: string) {
	const dtsFiles = await walkDtsFiles(outdir);

	for (const dtsFile of dtsFiles) {
		const md = await readDocsFile(srcdir, outdir, dtsFile);
		if (isNull(md)) continue;
		const { content } = splitFrontMatter(md);
		const sections = splitSections(content);
		if (isEmpty(sections)) continue;
		injectDocsIntoDts(dtsFile, sections);
	}
}

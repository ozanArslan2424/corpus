import fs from "fs";
import path from "path";

import { X } from "@ozanarslan/corpus";
import * as esbuild from "esbuild";
import hljs from "highlight.js";
import terser from "html-minifier-terser";
import * as marked from "marked";

import type { RouteFile } from "@/types";

const BASE_URL = "https://corpus-docs.fly.dev";
const FILES_DIR = path.join(import.meta.dir, "files");

function getTemplate() {
	const segments: Array<string> = [process.cwd()];
	if (!X.Config.isProd) segments.push("src");
	segments.push("template.html");
	return fs.readFileSync(path.join(...segments), "utf8");
}

function getParent(filesDir: string, parentPath: string, name: string): string | null {
	const clean = parentPath.replace(filesDir, "").replace("/", "");
	return clean === name || clean === "" ? null : clean;
}

function getFPath(parentPath: string, name: string, ext: string): string {
	return path.join(parentPath, `${name}${ext}`);
}

function getOutPath(outdir: string, parent: string | null, name: string, ext: string): string {
	return parent ? path.join(outdir, parent, `${name}${ext}`) : path.join(outdir, `${name}${ext}`);
}

function getAddr(parent: string | null, name: string, ext: string): string {
	return parent ? path.join("/", parent, `${name}${ext}`) : path.join("/", `${name}${ext}`);
}

function getOutExt(ext: string): string {
	if (ext === ".md") return ".html";
	if (ext === ".ts") return ".js";
	return ext;
}

function escapeHtml(code: string): string {
	return code
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function unescapeHtml(code: string): string {
	return code
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function initMarked() {
	const renderer = new marked.Renderer();

	renderer.code = ({ text, lang }) => {
		const copyIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1H12C12.5523 1 13 1.44772 13 2V10C13 10.5523 12.5523 11 12 11H6C5.44772 11 5 10.5523 5 10V2C5 1.44772 5.44772 1 6 1Z" stroke="currentColor" stroke-width="1.5"/><path d="M3 5H2C1.44772 5 1 5.44772 1 6V14C1 14.5523 1.44772 15 2 15H8C8.55228 15 9 14.5523 9 14V13" stroke="currentColor" stroke-width="1.5"/></svg>`;

		function codeCopyElement(escaped: string) {
			return `\t<div class="code-copy">\n\t\t<code>${escaped}</code>\n\t\t<button onclick="(async()=>{try{await navigator.clipboard.writeText(this.previousElementSibling.textContent);this.classList.add('copied');setTimeout(()=>this.classList.remove('copied'),2000)}catch(e){console.error('Failed to copy:',e)}})()" class="copy-btn" aria-label="Copy to clipboard">${copyIcon}</button>\n\t</div>\n`;
		}

		function preCodeCopyElement(escaped: string) {
			return `\t<pre><code>${escaped}</code></pre>\n`;
		}

		const escaped = escapeHtml(text);
		return lang === "sh" ? codeCopyElement(escaped) : preCodeCopyElement(escaped);
	};

	renderer.heading = ({ text, depth }) => {
		const codeMatch = text.match(/^`(.+)`$/);
		const inner = codeMatch ? `<code>${codeMatch[1]}</code>` : text;

		if (depth === 2) {
			const id = text
				.replace(/`/g, "")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			return `<h2 id="${id}">${inner}</h2>\n`;
		}

		return `<h${depth}>${inner}</h${depth}>\n`;
	};

	marked.marked.use({ renderer });
}

function getHead(routeFiles: Array<RouteFile>): string {
	return routeFiles
		.filter((rf) => rf.outExt === ".css" || rf.outExt === ".js")
		.map((rf) =>
			rf.outExt === ".css"
				? `<link rel="stylesheet" href="${rf.addr}" />`
				: `<script src="${rf.addr}"></script>`,
		)
		.join("\n");
}

function getSidebar(routeFiles: Array<RouteFile>) {
	function compareFn(a: RouteFile, b: RouteFile) {
		function rank(rf: RouteFile) {
			const n = rf.name.toLowerCase();
			if (n === "home") return 0;
			if (n === "quick start") return 1;
			if (n === "types") return 3;
			return 2;
		}
		const diff = rank(a) - rank(b);
		return diff !== 0 ? diff : a.name.localeCompare(b.name);
	}

	const roots = routeFiles.filter((rf) => rf.parent === null).sort(compareFn);
	const items = roots.map((rf) => {
		const children = routeFiles.filter((c) => c.parent === rf.name).sort(compareFn);
		const link = `<a href="${rf.addr}">${rf.name}</a>`;
		if (children.length === 0) return `<li>${link}</li>`;
		const sub = children.map((c) => `<li><a href="${c.addr}">${c.name}</a></li>`).join("\n");
		return `<li>${link}<ul>${sub}</ul></li>`;
	});
	return `<ul>${items.join("\n")}</ul>`;
}

function getHydrated(input: string, variables: Record<string, string>) {
	let result = input;
	for (const [key, content] of Object.entries(variables)) {
		const regex = new RegExp(`<!--\\s*${key}\\s*-->`);
		result = result.replace(regex, content);
	}
	return result;
}

async function getScriptsCompiled(input: string) {
	let result = input;

	const matches = Array.from(result.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));

	for (const match of matches) {
		const fullMatch = match[0];
		const attributes = match[1];
		const code = match[2];

		if (!code || code.trim().length === 0) continue;

		const compiledJs = await esbuild.transform(code, { loader: "js", minify: true });
		const newTag = `<script${attributes}>${compiledJs.code}</script>`;
		result = result.replace(fullMatch, newTag);
	}

	return result;
}

async function getCodesHighlighted(input: string) {
	let result = input;
	return result.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
		const language = "typescript";
		try {
			const highlighted = hljs.highlight(unescapeHtml(code), { language }).value;
			return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
		} catch (err) {
			console.warn("hljs fail:", err);
			return match;
		}
	});
}

function getHeadersCounted(input: string) {
	let result = input;
	let h2Count = 0;
	let h3Count = 0;
	let h4Count = 0;

	return result.replace(/<h([234])([^>]*)>/g, (_match, level: string, attrs: string) => {
		let counter = "";
		if (level === "2") {
			h2Count++;
			h3Count = 0;
			h4Count = 0;
			counter = `${h2Count}`;
		} else if (level === "3") {
			h3Count++;
			h4Count = 0;
			counter = `${h2Count}.${h3Count}`;
		} else if (level === "4") {
			h4Count++;
			counter = `${h2Count}.${h3Count}.${h4Count}`;
		}
		return `<h${level}${attrs} data-counter="${counter}">`;
	});
}

async function compileRouteFiles(map: Map<string, string>, routeFiles: Array<RouteFile>) {
	const template = getTemplate();
	const sidebar = getSidebar(routeFiles);
	const head = getHead(routeFiles);

	for (const routeFile of routeFiles) {
		if (routeFile.ext === ".css" || routeFile.ext === ".js" || routeFile.ext === ".ts") {
			const content = fs.readFileSync(routeFile.fpath, "utf8");
			const transformed = await esbuild.transform(content, {
				loader: routeFile.ext.replace(".", "") as never,
				minify: true,
			});
			map.set(routeFile.outPath, transformed.code);
		} else {
			const rawContent = fs.readFileSync(routeFile.fpath, "utf8");
			const content =
				routeFile.ext === ".md" ? `<main>\n${await marked.marked(rawContent)}</main>` : rawContent;
			let result = template;
			const variables = { head, sidebar, content };
			result = getHydrated(result, variables);
			result = await getScriptsCompiled(result);
			result = await getCodesHighlighted(result);
			result = getHeadersCounted(result);
			result = await terser.minify(result, {
				collapseWhitespace: true,
				removeComments: true,
				removeOptionalTags: true,
				removeRedundantAttributes: true,
				removeScriptTypeAttributes: true,
				removeStyleLinkTypeAttributes: true,
				useShortDoctype: true,
			});
			map.set(routeFile.outPath, result);
		}
	}
}

function compareRank(a: RouteFile, b: RouteFile) {
	function rank(rf: RouteFile) {
		const n = rf.name.toLowerCase();
		if (n === "home") return 0;
		if (n === "quick start") return 1;
		if (n === "types") return 3;
		return 2;
	}
	const diff = rank(a) - rank(b);
	return diff !== 0 ? diff : a.name.localeCompare(b.name);
}

// depth-first order matching the sidebar, but unlike the sidebar this never drops pages:
// any file whose parent doesn't match a root's name (enums/*, Parser/*, etc.) still
// gets included, grouped by folder, appended after the nav-matched roots+children.
function getOrderedMdFiles(routeFiles: Array<RouteFile>): Array<RouteFile> {
	const mdFiles = routeFiles.filter((rf) => rf.ext === ".md");
	const roots = mdFiles.filter((rf) => rf.parent === null).sort(compareRank);
	const rootNames = new Set(roots.map((rf) => rf.name));

	const ordered: Array<RouteFile> = [];
	const seen = new Set<RouteFile>();

	for (const root of roots) {
		ordered.push(root);
		seen.add(root);
		const children = mdFiles.filter((c) => c.parent === root.name).sort(compareRank);
		for (const child of children) {
			ordered.push(child);
			seen.add(child);
		}
	}

	const orphans = mdFiles.filter((rf) => !seen.has(rf) && !rootNames.has(rf.parent ?? ""));
	const byParent = new Map<string, Array<RouteFile>>();
	for (const rf of orphans) {
		const key = rf.parent ?? "";
		if (!byParent.has(key)) byParent.set(key, []);
		byParent.get(key)!.push(rf);
	}
	for (const key of Array.from(byParent.keys()).sort()) {
		ordered.push(...byParent.get(key)!.sort((a, b) => a.name.localeCompare(b.name)));
	}

	return ordered;
}

function toMdPath(addr: string): string {
	return addr.replace(/\.html$/, ".md");
}

function getRobotsTxt(): string {
	return `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`;
}

function getSitemapLoc(rf: RouteFile): string {
	return rf.addr === "/index.html" ? `${BASE_URL}/` : `${BASE_URL}${rf.addr}`;
}

function getSitemapXml(routeFiles: Array<RouteFile>): string {
	const htmlFiles = routeFiles.filter((rf) => rf.outExt === ".html");
	const urls = htmlFiles
		.map((rf) => `\t<url>\n\t\t<loc>${getSitemapLoc(rf)}</loc>\n\t</url>`)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function getLlmsTxt(routeFiles: Array<RouteFile>): string {
	const ordered = getOrderedMdFiles(routeFiles);
	const lines: Array<string> = [];

	lines.push("# @ozanarslan/corpus");
	lines.push("");
	lines.push(
		"> Lightweight zero-dependency TypeScript framework for Bun. No decorators, no DI container, no abstractions hiding what's really happening — just routes, handlers, and code that reads like code.",
	);
	lines.push("");
	lines.push("## Docs");
	for (const rf of ordered) {
		const label = rf.parent ? `${rf.parent}: ${rf.name}` : rf.name;
		lines.push(`- [${label}](${BASE_URL}${toMdPath(rf.addr)})`);
	}
	lines.push("");
	lines.push("## Optional");
	lines.push(`- [Full text](${BASE_URL}/llms-full.txt): every doc page concatenated into one file`);

	return `${lines.join("\n")}\n`;
}

function getLlmsFullTxt(routeFiles: Array<RouteFile>): string {
	const ordered = getOrderedMdFiles(routeFiles);
	const parts = ordered.map((rf) => {
		const raw = fs.readFileSync(rf.fpath, "utf8");
		const heading = rf.parent ? `# ${rf.parent}: ${rf.name}` : `# ${rf.name}`;
		return `${heading}\n\n${raw.trim()}`;
	});
	return `${parts.join("\n\n---\n\n")}\n`;
}

function compileMetaFiles(map: Map<string, string>, outdir: string, routeFiles: Array<RouteFile>) {
	map.set(path.join(outdir, "robots.txt"), getRobotsTxt());
	map.set(path.join(outdir, "sitemap.xml"), getSitemapXml(routeFiles));
	map.set(path.join(outdir, "llms.txt"), getLlmsTxt(routeFiles));
	map.set(path.join(outdir, "llms-full.txt"), getLlmsFullTxt(routeFiles));

	// raw markdown copies, served alongside the compiled .html so llms.txt links resolve
	for (const rf of routeFiles.filter((r) => r.ext === ".md")) {
		const raw = fs.readFileSync(rf.fpath, "utf8");
		const mdOutPath = toMdPath(rf.outPath);
		map.set(mdOutPath, raw);
	}
}

async function getRouteFiles(outdir: string): Promise<Array<RouteFile>> {
	const routeFiles: Array<RouteFile> = [];
	const entries = fs.readdirSync(FILES_DIR, { withFileTypes: true, recursive: true });

	const SPECIAL_NAME_MAP: Record<string, string> = {
		index: "Home",
		C: "C Modules Introduction",
		X: "X Modules Introduction",
	};

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (entry.name.startsWith(".")) continue;
		const parsed = path.parse(entry.name);
		const parent = getParent(FILES_DIR, entry.parentPath, parsed.name);
		const outExt = getOutExt(parsed.ext);
		const fpath = getFPath(entry.parentPath, parsed.name, parsed.ext);
		const outPath = getOutPath(outdir, parent, parsed.name, outExt);
		const addr = getAddr(parent, parsed.name, outExt);
		const name = SPECIAL_NAME_MAP[parsed.name] ?? decodeURIComponent(parsed.name);
		const ext = parsed.ext;
		routeFiles.push({ name, ext, addr, parent, fpath, outPath, outExt });
	}

	return routeFiles;
}

export async function compileNoWrite(outdir: string) {
	initMarked();
	const routeFiles = await getRouteFiles(outdir);
	const map = new Map<string, string>();
	await compileRouteFiles(map, routeFiles);
	compileMetaFiles(map, outdir, routeFiles);
	return { map, routeFiles };
}

export async function compile(outdir: string): Promise<void> {
	const { map } = await compileNoWrite(outdir);
	for (const [outPath, html] of map.entries()) {
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, html);
	}
}

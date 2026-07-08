import { X } from "@ozanarslan/corpus";

import { FileHelper } from "@/compiler/FileHelper";
import { HtmlHelper } from "@/compiler/HtmlHelper";
import { MdHelper } from "@/compiler/MdHelper";
import { Minifier } from "@/compiler/Minifier";

export async function compile(outDir: string) {
	const minifier = new Minifier();
	const h = new HtmlHelper();
	const m = new MdHelper(h);
	const f = new FileHelper(outDir);

	async function getSharedHtml(name: string, templateEntries?: Record<string, string>) {
		const file = new X.File(f.addr("html", `${name}.html`));

		let content = await file.text();
		content = await minifier.scriptTags(content);
		if (templateEntries) {
			content = h.hydrate(content, templateEntries);
		}
		return content;
	}

	async function writeStyles() {
		const cssPaths = await f.files(f.addr("css"), "css");
		let styles = "";

		for (const cssPath of cssPaths) {
			const file = new X.File(cssPath);
			console.log("Minifying:", file.fullname);

			let content = await file.text();
			content = await minifier.css(content);

			styles += `${content}\n`;
		}

		await f.write(f.out("styles.css"), styles);
	}

	async function writeScripts() {
		const jsPaths = await f.files(f.addr("js"), "js");
		let scripts = "";

		for (const jsPath of jsPaths) {
			const file = new X.File(jsPath);
			console.log("Minifying:", file.fullname);

			let content = await file.text();
			content = await minifier.javascript(content);

			scripts += `${content}\n`;
		}

		await f.write(f.out("scripts.js"), scripts);
	}

	async function writePages(layout: string, header: string, sidebar: string) {
		const baseMdPath = f.addr("md");
		const mdPaths = await f.files(baseMdPath, "md");

		for (const mdPath of mdPaths) {
			const file = new X.File(mdPath);
			console.log("Converting:", file.fullname);

			let content = await file.text();
			content = await m.toHTML(content);
			content = await minifier.scriptTags(content);
			content = h.hydrate(layout, { header, sidebar, content });
			content = h.highlightCode(content);
			content = h.countHeaders(content);
			content = await minifier.html(content);

			const subPath = mdPath.replace(baseMdPath, "").replace(file.fullname, "");
			const pathSegments = subPath.split("/").filter(Boolean);
			const htmlPath =
				file.name === "index"
					? f.out(...pathSegments.slice(0, -1), `${file.parentDirs[0] ?? file.name}.html`)
					: f.out(...pathSegments, `${file.name}.html`);
			await f.write(htmlPath, content);
		}
	}

	async function writeIndexFile(layout: string, header: string, sidebar: string) {
		const file = new X.File(f.addr("html", "index.html"));
		let content = await file.text();
		content = h.hydrate(layout, { header, sidebar, content });
		content = await minifier.html(content);
		await f.write(f.out("index.html"), content);
	}

	const parts = await Promise.all([
		getSharedHtml("layout"),
		getSharedHtml("header", { brand: "@ozanarslan/corpus" }),
		getSharedHtml("sidebar"),
	]);
	await Promise.all([
		writeStyles(),
		writeScripts(),
		writePages(...parts),
		writeIndexFile(...parts),
	]);

	console.log("Finished");
}

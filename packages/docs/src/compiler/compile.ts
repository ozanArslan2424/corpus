import { X } from "@ozanarslan/corpus";

import { FileHelper } from "@/compiler/FileHelper";
import { HtmlHelper } from "@/compiler/HtmlHelper";
import { MdHelper } from "@/compiler/MdHelper";
import { Minifier } from "@/compiler/Minifier";

export async function compile(outDir: string) {
	const minifier = new Minifier();
	const htmlh = new HtmlHelper();
	const mdh = new MdHelper(htmlh);
	const fh = new FileHelper(outDir);

	async function getSharedHtml(name: string, templateEntries?: Record<string, string>) {
		const file = new X.File(fh.addr("html", `${name}.html`));

		let content = await file.text();
		content = await minifier.scriptTags(content);
		if (templateEntries) {
			content = htmlh.hydrate(content, templateEntries);
		}
		return content;
	}

	async function writeStyles() {
		const cssPaths = await fh.files(fh.addr("css"), "css");
		let styles = "";

		for (const cssPath of cssPaths) {
			const file = new X.File(cssPath);
			console.log("Minifying:", file.fullname);

			let content = await file.text();
			content = await minifier.css(content);

			styles += `${content}\n`;
		}

		await fh.write(fh.out("styles.css"), styles);
	}

	async function writeScripts() {
		const jsPaths = await fh.files(fh.addr("js"), "js");
		let scripts = "";

		for (const jsPath of jsPaths) {
			const file = new X.File(jsPath);
			console.log("Minifying:", file.fullname);

			let content = await file.text();
			content = await minifier.javascript(content);

			scripts += `${content}\n`;
		}

		await fh.write(fh.out("scripts.js"), scripts);
	}

	async function writePages(layout: string, header: string, sidebar: string) {
		const baseMdPath = fh.addr("md");
		const mdPaths = await fh.files(baseMdPath, "md");

		for (const mdPath of mdPaths) {
			const file = new X.File(mdPath);
			console.log("Converting:", file.fullname);

			let content = await file.text();
			content = await mdh.toHTML(content);
			content = await minifier.scriptTags(content);
			content = htmlh.hydrate(layout, { header, sidebar, content });
			content = htmlh.highlightCode(content);
			content = htmlh.countHeaders(content);
			content = await minifier.html(content);

			const subPath = mdPath.replace(baseMdPath, "").replace(file.fullname, "");
			const pathSegments = subPath.split("/").filter(Boolean);
			const htmlPath =
				file.name === "index"
					? fh.out(...pathSegments.slice(0, -1), `${file.parentDirs[0] ?? file.name}.html`)
					: fh.out(...pathSegments, `${file.name}.html`);
			await fh.write(htmlPath, content);
		}
	}

	async function writeIndexFile(layout: string, header: string, sidebar: string) {
		const file = new X.File(fh.addr("html", "index.html"));
		let content = await file.text();
		content = htmlh.hydrate(layout, { header, sidebar, content });
		content = await minifier.html(content);
		await fh.write(fh.out("index.html"), content);
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

import fs from "fs/promises";
import path from "path";

const root = import.meta.dir;

const srcDir = path.join(root, "src");
const outDir = path.join(root, "dist");

const filesDir = path.join(srcDir, "files");
const filesDirOut = path.join(outDir, "files");

const templateHtml = path.join(srcDir, "template.html");
const templateHtmlOut = path.join(outDir, "template.html");

const entrypoint = path.join(srcDir, "index.ts");

async function clean(dir: string) {
	await fs.rm(dir, { recursive: true, force: true });
}

async function copy(from: string, to: string) {
	await fs.mkdir(path.dirname(to), { recursive: true });
	await fs.cp(from, to, { recursive: true });
}

async function build(entry: string, dir: string) {
	const res = await Bun.build({
		entrypoints: [entry],
		outdir: dir,
		target: "bun",
		format: "esm",
		external: ["esbuild"],
	});
	if (!res.success) {
		res.logs.forEach((l) => console.error(l));
		process.exit(1);
	}
}

try {
	await clean(outDir);
	await copy(filesDir, filesDirOut);
	await copy(templateHtml, templateHtmlOut);
	await build(entrypoint, outDir);
} catch (err) {
	console.error(err);
	process.exit(1);
}

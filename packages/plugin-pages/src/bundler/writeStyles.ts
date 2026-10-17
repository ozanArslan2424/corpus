import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Manifest } from "@/bundler/writeManifest";
import { getRenderable } from "@/runtime/registry";

export async function writeStyles(manifest: Manifest, outdir: string) {
	const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-styles-"));

	try {
		await fs.mkdir(outdir, { recursive: true });

		const entrypoints: Array<string> = [];

		for (const style of manifest.styles) {
			const str = getRenderable(style.ref)?.style?.toString();
			if (!str) continue;
			const entry = path.join(workdir, `${style.ref}.css`);
			await fs.writeFile(entry, str);
			entrypoints.push(entry);
		}

		if (entrypoints.length === 0) return;

		const build = await Bun.build({
			entrypoints,
			outdir,
			naming: "[name].[ext]",
			minify: true,
			throw: false,
		});

		if (!build.success) throw new AggregateError(build.logs, "bundle failed");
	} finally {
		await fs.rm(workdir, { recursive: true, force: true });
	}
}

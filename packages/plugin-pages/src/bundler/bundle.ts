import fs from "node:fs/promises";
import path from "node:path";

import { writeManifest } from "@/bundler/writeManifest";
import { writeRouter } from "@/bundler/writeRouter";
import { writeScripts } from "@/bundler/writeScripts";
import { writeStyles } from "@/bundler/writeStyles";

export async function bundle(assetsDir: string) {
	if (await fs.exists(assetsDir)) await fs.rm(assetsDir, { recursive: true });
	await fs.mkdir(assetsDir, { recursive: true });

	const manifest = await writeManifest(assetsDir);

	await Promise.all([
		writeStyles(manifest, path.join(assetsDir, "styles")),
		writeScripts(manifest, path.join(assetsDir, "scripts")),
		writeRouter(assetsDir),
	]);
}

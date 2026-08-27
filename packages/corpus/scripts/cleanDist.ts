import fs from "fs/promises";

export async function cleanDist(outdir: string) {
	const exists = await fs.exists(outdir);
	if (!exists) return;
	await fs.rm(outdir, { recursive: true, force: true });
}

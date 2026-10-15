import fs from "node:fs/promises";
import path from "node:path";

/** The client router, prebuilt from `src/browser/start.ts` into `dist/` next to this module. */
const ROUTER_FILE = path.join(import.meta.dir, "router.js");

/** Copies the prebuilt client router into `outdir` as `router.js`. Returns its contents. */
export async function bundleRouter(outdir: string): Promise<string> {
	const source = await fs.readFile(ROUTER_FILE, "utf8");
	await fs.writeFile(path.join(outdir, "router.js"), source);
	return source;
}

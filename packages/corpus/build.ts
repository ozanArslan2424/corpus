import fs from "fs/promises";

import { logger, Timer } from "@ozanarslan/utils";
import dts from "bun-plugin-dts";

async function clean(outdir: string) {
	const exists = await fs.exists(outdir);
	if (!exists) return;
	await fs.rm(outdir, { recursive: true, force: true });
}

async function build(entrypoints: Array<string>, outdir: string, tsconfig: string) {
	const res = await Bun.build({
		entrypoints,
		external: [],
		format: "esm",
		target: "bun",
		minify: true,
		sourcemap: true,
		outdir,
		tsconfig,
		plugins: [
			dts({
				compilationOptions: { preferredConfigPath: tsconfig },
				output: { inlineDeclareGlobals: true },
			}),
		],
	});

	if (!res.success) {
		res.logs.forEach((l) => logger.error(l));
		process.exit(1);
	}
}

try {
	const t = new Timer();
	const entrypoints = ["./src/index.ts"];
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";

	t.step("cleaning dist");
	await clean(outdir);
	t.done("cleaned dist");

	t.step("building esm");
	await build(entrypoints, outdir, tsconfig);
	t.done("built esm");
} catch (err) {
	logger.error(err);
	process.exit(1);
}

import fs from "fs/promises";

import { logger, Timer } from "@/utils";

async function clean(outdir: string) {
	const exists = await fs.exists(outdir);
	if (!exists) return;
	await fs.rm(outdir, { recursive: true, force: true });
}

async function buildJs(entrypoints: Array<string>, outdir: string, tsconfig: string) {
	const res = await Bun.build({
		entrypoints,
		external: [],
		format: "esm",
		target: "bun",
		minify: true,
		sourcemap: true,
		outdir,
		tsconfig,
		splitting: true,
	});
	if (!res.success) {
		res.logs.forEach((l) => logger.error(l));
		process.exit(1);
	}
}

async function buildDts(tsconfig: string) {
	const proc = Bun.spawn(["bunx", "tsc", "-p", tsconfig], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	if (code !== 0) process.exit(code);
}

try {
	const t = new Timer();
	const entrypoints = ["./src/utils/index.ts", "./src/index.ts"];
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";
	const tsconfigDts = "./tsconfig.dts.json";

	t.step("cleaning dist");
	await clean(outdir);
	t.done("cleaned dist");

	t.step("building esm");
	await buildJs(entrypoints, outdir, tsconfig);
	t.done("built esm");

	t.step("building dts");
	await buildDts(tsconfigDts);
	t.done("built dts");
} catch (err) {
	logger.error(err);
	process.exit(1);
}

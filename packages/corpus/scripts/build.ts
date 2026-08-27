import { logger, Timer } from "@/utils";

import { buildDts } from "./buildDts";
import { buildJs } from "./buildJs";
import { cleanDist } from "./cleanDist";
import { injectDocs } from "./injectDocs";

try {
	const t = new Timer();
	const entrypoints = ["./src/utils/index.ts", "./src/index.ts"];
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";
	const tsconfigDts = "./tsconfig.dts.json";
	const srcdir = "./src";

	t.step("cleaning dist");
	await cleanDist(outdir);
	t.done("cleaned dist");

	t.step("building esm");
	await buildJs(entrypoints, outdir, tsconfig);
	t.done("built esm");

	t.step("building dts");
	await buildDts(tsconfigDts);
	t.done("built dts");

	t.step("injecting docs");
	await injectDocs(srcdir, outdir);
	t.done("injected docs");
} catch (err) {
	logger.error(err);
	process.exit(1);
}

import * as Bun from "bun";

import { logger } from "@/utils";

export async function buildJs(entrypoints: Array<string>, outdir: string, tsconfig: string) {
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

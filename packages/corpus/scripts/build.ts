import fs from "fs/promises";

import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";

import { logger } from "@/utils/logger";
import { Timer } from "@/utils/Timer";

async function cleanDist(outdir: string) {
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
	const configFile = ts.readConfigFile(tsconfig, ts.sys.readFile);
	if (configFile.error) {
		logger.error(ts.formatDiagnostic(configFile.error, ts.createCompilerHost({})));
		process.exit(1);
	}

	const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
	if (parsed.errors.length) {
		const host = ts.createCompilerHost(parsed.options);
		parsed.errors.forEach((d) => logger.error(ts.formatDiagnostic(d, host)));
		process.exit(1);
	}

	const program = ts.createProgram({
		rootNames: parsed.fileNames,
		options: parsed.options,
	});

	const emitResult = program.emit();

	const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

	if (diagnostics.length) {
		const host = ts.createCompilerHost(parsed.options);
		diagnostics.forEach((d) => logger.error(ts.formatDiagnostic(d, host)));
	}

	if (
		emitResult.emitSkipped ||
		diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error)
	) {
		process.exit(1);
	}

	await replaceTscAliasPaths({
		configFile: tsconfig,
	});
}

try {
	const t = new Timer();
	const entrypoints = ["./src/index.ts", "./src/utils.ts"];
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";
	const tsconfigDts = "./tsconfig.dts.json";
	// const srcdir = "./src";

	t.step("cleaning dist");
	await cleanDist(outdir);
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

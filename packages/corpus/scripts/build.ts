import fs from "fs/promises";

import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";

import { logger } from "@/utils/logger";

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

let t: number = 0;

function ms() {
	const elapsed = performance.now() - t;
	return elapsed >= 1000
		? `\x1b[31m${(elapsed / 1000).toFixed(2)}s\x1b[0m`
		: `\x1b[33m${elapsed.toFixed(2)}ms\x1b[0m`;
}

function step(label: string) {
	logger.step(`${label} ${ms()}`);
	t = performance.now();
}

function done(label: string) {
	logger.success(`${label} ${ms()}`);
}

try {
	const entrypoints = ["./src/index.ts"];
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";
	const tsconfigDts = "./tsconfig.dts.json";
	// const srcdir = "./src";

	step("cleaning dist");
	await cleanDist(outdir);
	done("cleaned dist");

	step("building esm");
	await buildJs(entrypoints, outdir, tsconfig);
	done("built esm");

	step("building dts");
	await buildDts(tsconfigDts);
	done("built dts");
} catch (err) {
	logger.error(err);
	process.exit(1);
}

import fs from "fs/promises";

import dts from "bun-plugin-dts";

import { logger } from "@/utils/logger";
import { Timer } from "@/utils/Timer";

async function clean(outdir: string) {
	const exists = await fs.exists(outdir);
	if (!exists) return;
	await fs.rm(outdir, { recursive: true, force: true });
}

async function build(outdir: string, tsconfig: string) {
	const res = await Bun.build({
		entrypoints: ["./src/index.ts"],
		format: "esm",
		target: "bun",
		minify: true,
		sourcemap: true,
		outdir,
		tsconfig,
		plugins: [dts({ compilationOptions: { preferredConfigPath: tsconfig } })],
	});

	if (!res.success) res.logs.forEach((l) => logger.error(l));
	if (!res.success) process.exit(1);
}

try {
	const t = new Timer();
	const outdir = "./dist";
	const tsconfig = "./tsconfig.json";

	t.step("cleaning dist");
	await clean(outdir);
	t.done("cleaned dist");

	t.step("building esm");
	await build(outdir, tsconfig);
	t.done("built esm");
} catch (err) {
	logger.error(err);
	process.exit(1);
}

// import fs from "fs/promises";
//
// import { replaceTscAliasPaths } from "tsc-alias";
// import ts from "typescript";
//
// import { logger } from "@/utils/logger";
// import { Timer } from "@/utils/Timer";
//
// async function clean(outdir: string) {
// 	const exists = await fs.exists(outdir);
// 	if (!exists) return;
// 	await fs.rm(outdir, { recursive: true, force: true });
// }
//
// async function build(outdir: string, tsconfig: string) {
// 	const res = await Bun.build({
// 		entrypoints: ["./src/index.ts"],
// 		format: "esm",
// 		target: "bun",
// 		minify: true,
// 		sourcemap: true,
// 		outdir,
// 		tsconfig,
// 	});
// 	if (!res.success) res.logs.forEach((l) => logger.error(l));
// 	if (!res.success) process.exit(1);
// }
//
// function emitDeclarations(outdir: string, tsconfigPath: string) {
// 	const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
// 	if (configFile.error) {
// 		logger.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
// 		process.exit(1);
// 	}
// 	const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");
// 	const rootNames = parsedConfig.fileNames.filter(
// 		(f) => !f.includes("/test/") && !f.startsWith("test/") && f !== "build.ts",
// 	);
// 	const program = ts.createProgram({
// 		rootNames,
// 		options: {
// 			...parsedConfig.options,
// 			declaration: true,
// 			emitDeclarationOnly: true,
// 			noEmit: false,
// 			outDir: outdir,
// 			rootDir: "./src",
// 		},
// 	});
// 	const emitResult = program.emit();
// 	const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
// 	if (diagnostics.length > 0) {
// 		logger.error(
// 			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
// 				getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
// 				getCanonicalFileName: (f) => f,
// 				getNewLine: () => ts.sys.newLine,
// 			}),
// 		);
// 	}
// 	if (
// 		emitResult.emitSkipped ||
// 		diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error)
// 	) {
// 		logger.error("Declaration emit failed");
// 		process.exit(1);
// 	}
// }
//
// async function fixDeclarationAliases(outdir: string, tsconfigPath: string) {
// 	await replaceTscAliasPaths({
// 		configFile: tsconfigPath,
// 		outDir: outdir,
// 		declarationDir: outdir,
// 	});
// }
//
// try {
// 	const t = new Timer();
// 	const outdir = "./dist";
// 	const tsconfig = "./tsconfig.json";
//
// 	t.step("cleaning dist");
// 	await clean(outdir);
// 	t.done("cleaned dist");
//
// 	t.step("building esm");
// 	await build(outdir, tsconfig);
// 	t.done("built esm");
//
// 	t.step("generating declarations");
// 	emitDeclarations(outdir, tsconfig);
// 	t.done("generated declarations");
//
// 	t.step("fixing declaration aliases");
// 	await fixDeclarationAliases(outdir, tsconfig);
// 	t.done("fixed declaration aliases");
// } catch (err) {
// 	logger.error(err);
// 	process.exit(1);
// }

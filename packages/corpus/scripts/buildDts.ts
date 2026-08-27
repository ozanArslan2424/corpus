import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";

import { logger } from "@/utils";

export async function buildDts(tsconfig: string) {
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

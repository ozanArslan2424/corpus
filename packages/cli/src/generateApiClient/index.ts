import { spawnSync } from "child_process";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { DIST_API_GENERATOR_FILE, API_GENERATOR_CLASS_NAME } from "@/constants";
import { hoistFunctionBody } from "@/utils/functions";
import { logFatal } from "@/utils/logger";

import type { Config } from "../config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function generateApiClient(config: Config) {
	const mainPath = resolve(config.main);

	const cliOverrides = Object.fromEntries(
		Object.entries(config).filter(([k, v]) => v != null && k !== "jsonSchemaOptions"),
	);

	const tempPath = mainPath.replace(/\.ts$/, ".gen.ts");

	try {
		const lines: string[] = [`import { $registry } from "${config.pkgPath}";`];
		const generatorPath = join(__dirname, DIST_API_GENERATOR_FILE);
		lines.push(`import { ${API_GENERATOR_CLASS_NAME} } from "${generatorPath}";`);
		console.log(`📄 Reading main file: ${mainPath}`);
		const mainFileContents = readFileSync(mainPath, "utf-8");
		const REPLACE_TARGET = /^(void|await)?\s*\w+\.listen\(.*?\);.*$/m;

		const processedContents = hoistFunctionBody(mainFileContents);

		if (!REPLACE_TARGET.test(processedContents)) {
			logFatal(
				`⚠️  Could not find a .listen() call in: ${mainPath}.\n   Make sure your entry file calls .listen() either at the top level or inside a function.`,
			);
		}

		const replacement = [
			`const generator = new ${API_GENERATOR_CLASS_NAME}($registry, ${JSON.stringify(cliOverrides)});`,
			`await generator.generate();`,
		].join("\n");

		const patched = processedContents.replace(REPLACE_TARGET, replacement);
		lines.push(patched);
		writeFileSync(tempPath, lines.join("\n"), "utf-8");
		console.log(`🔧 Patched file written: ${tempPath}`);

		console.log(`🚀 Running generator...`);
		const result = spawnSync("bun", ["run", tempPath], {
			stdio: "inherit",
			env: process.env,
		});

		if (result.status !== 0) {
			throw new Error(`bun exited with status ${result.status}`);
		}

		console.log(`Generator completed successfully`);
	} catch (err) {
		console.error((err as Error).message);
		process.exit(1);
	} finally {
		unlinkSync(tempPath);
		console.log(`🧹 Temp file cleaned up: ${tempPath}`);
	}
}

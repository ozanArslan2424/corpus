import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { EXE_NAME, GEN_FUNC, LISTEN_PATTERN } from "@/constants";
import { findEnclosingFunctionName } from "@/utils/functions";
import { logFatal, logger } from "@/utils/logger";
import { ModuleAbstract } from "@/utils/ModuleAbstract";
import { resolveCwdPath } from "@/utils/paths";
import { StringBuilder } from "@/utils/StringBuilder";

export class ApiClientModule extends ModuleAbstract {
	override keys = ["api"];
	override get help(): string[] {
		return [
			"Codegen for all routes",
			"Generates types and model interfaces for all routes.",
			"Generates an api client with methods for all routes. (unless disabled in config)",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")}`,
			"",
			"Note: Your entry file must call `.listen()` either at the top level",
			"or inside a single function.",
		];
	}

	override async main(): Promise<void> {
		const mainPath = path.resolve(this.config.main);
		const outPath = mainPath.replace(/\.ts$/, ".temp.mjs");
		const generatorImport =
			process.env.NODE_ENV === "development"
				? "@/index"
				: process.env.NODE_ENV === "test"
					? resolveCwdPath("dist")
					: "@ozanarslan/corpus-cli";

		try {
			const b = new StringBuilder();
			b.line(`import { $registry } from "${this.config.pkgPath}";`);
			b.line(`import { ${GEN_FUNC} } from "${generatorImport}";`);

			logger.step(`Reading main file at ${mainPath}`);
			let mainFileContents = fs.readFileSync(mainPath, "utf-8");
			const match = LISTEN_PATTERN.exec(mainFileContents);
			if (!match) {
				logFatal(
					`
Could not find a .listen() call in: ${mainPath}.
    Make sure your entry file calls .listen() either at the top level or inside a top level function.
`.trim(),
				);
			}
			const funcName = findEnclosingFunctionName(mainFileContents, match.index);
			if (funcName) {
				logger.step(`Making sure ${funcName} is called.`);
				const callSite = new RegExp(`^\\s*(?:void|await)?\\s*${funcName}\\s*\\(\\s*\\);?.*$`, "gm");
				mainFileContents = mainFileContents.replace(callSite, "");
				mainFileContents += `\n\nawait ${funcName}();\n`;
			}
			mainFileContents = mainFileContents.replace(
				LISTEN_PATTERN,
				`
try {
    const prefix = $registry.prefix;
    const routesArr = $registry.router.list();
    const config = ${JSON.stringify(this.config)};
    ${GEN_FUNC}(prefix, routesArr, config);
    process.exit(0);
} catch (err) {
    console.log(String(err));
    process.exit(1);
}
`.trim(),
			);
			b.line(mainFileContents);

			logger.step(`Transpiling to JS...`);
			const transpiler = new Bun.Transpiler({ loader: "ts" });
			const js = transpiler.transformSync(b.toString());

			logger.step(`Writing temp file at ${outPath}`);
			fs.writeFileSync(outPath, js, "utf-8");

			logger.step(`Running generator...`);
			const result = spawnSync(process.execPath, [outPath], {
				stdio: "inherit",
				env: process.env,
			});
			if (result.status !== 0) {
				logFatal(`exited with status ${result.status}`);
			}
			logger.success(`Generator completed successfully`);
		} catch (err) {
			logger.error(String(err));
			process.exit(1);
		} finally {
			logger.step(`Deleting temp file at ${outPath}`);
			fs.rmSync(outPath, { force: true });
		}
	}
}

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { GEN_FUNC, LISTEN_PATTERN } from "@/constants";
import { findEnclosingFunctionName } from "@/utils/functions";
import { logFatal, logger } from "@/utils/logger";
import { ModuleAbstract } from "@/utils/ModuleAbstract";
import { resolveCwdPath } from "@/utils/paths";
import { StringBuilder } from "@/utils/StringBuilder";

export class ApiClientModule extends ModuleAbstract {
	override keys = ["api"];
	override get help(): string[] {
		return [];
	}

	override main(): void | Promise<void> {
		const mainPath = path.resolve(this.config.main);
		const tempPath = mainPath.replace(/\.ts$/, ".temp.ts");
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
					`Could not find a .listen() call in: ${mainPath}.\n   Make sure your entry file calls .listen() either at the top level or inside a function.`,
				);
			}
			// if the listen call lived inside a function, that function must run for the
			// routes to register: drop any existing call sites and append exactly one
			const funcName = findEnclosingFunctionName(mainFileContents, match.index);

			if (funcName) {
				logger.step(`Making sure ${funcName} is called.`);
				const callSite = new RegExp(`^\\s*(?:void|await)?\\s*${funcName}\\s*\\(\\s*\\);?.*$`, "gm");
				mainFileContents = mainFileContents.replace(callSite, "");
				mainFileContents += `\n\nawait ${funcName}();\n`;
			}

			mainFileContents = mainFileContents.replace(
				LISTEN_PATTERN,
				`${GEN_FUNC}($registry, ${JSON.stringify(this.config)});`,
			);

			b.line(mainFileContents);

			logger.step(`Writing temp file at ${tempPath}`);
			const content = b.toString();
			fs.writeFileSync(tempPath, content, "utf-8");

			logger.step(`Running generator...`);
			const result = spawnSync("bun", ["run", tempPath], {
				stdio: "inherit",
				env: process.env,
			});
			if (result.status !== 0) {
				logFatal(`bun exited with status ${result.status}`);
			}

			logger.success(`Generator completed successfully`);
		} catch (err) {
			logger.error(String(err));
			process.exit(1);
		} finally {
			logger.step(`Deleting temp file at ${tempPath}`);
			fs.unlinkSync(tempPath);
		}
	}
}

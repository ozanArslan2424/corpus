import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "util";

import * as p from "@clack/prompts";

import type { Config, PartialConfig } from "@/config";
import {
	type Action,
	ACTIONS,
	ACCEPTED_PACKAGE_MANAGERS,
	ACCEPTED_VALIDATION_LIBS,
	CONFIG_FILE_NAME,
} from "@/constants";
import { Formatter } from "@/Formatter/Formatter";
import { logFatal, logger } from "@/utils/logger";
import { registerSilentConsole } from "@/utils/registerSilentConsole";

export class ConfigManager {
	static getAction(): Action {
		const args = process.argv;
		const action = args[2] as Action | undefined;

		if (!action || !ACTIONS.includes(action)) {
			logger.bold("No action provided. Available actions:");
			logger.info("  api   — generate types and API client from your server entry file");
			logger.info("          example: corpus api -m ./src/main.ts -o ./src/corpus.gen.ts");
			logger.info("  init  — scaffold an empty Corpus project");
			logger.info("          example: corpus init");
			logFatal("Please provide an action and try again.");
		}
		return action;
	}

	static getDefaultConfig(): Config {
		return {
			silent: false,
			main: "./src/main.ts",
			pkgPath: "@ozanarslan/corpus",
			casing: "pascal",
			validationLibrary: null,
			packageManager: "bun",
			output: "./src/corpus.gen.ts",
			exportClientAs: "CorpusApi",
			exportModelsAs: "Models",
			exportArgsAs: "Args",
			exportEntitiesAs: "Entities",
			ignoreGlobalPrefix: false,
			jsonSchemaOptions: {
				fallback: (ctx: any) => ctx.base,
			},
		};
	}

	static getFileConfig(): PartialConfig {
		const extensions = [".ts", ".js"];
		const base = path.resolve(process.cwd(), CONFIG_FILE_NAME.replace(".ts", ""));
		const configPath = extensions.map((ext) => base + ext).find(fs.existsSync);
		const fileC: PartialConfig = configPath ? require(configPath).default : {};
		return fileC;
	}

	static getFlagConfig(): PartialConfig {
		const args = process.argv;

		const { values: flagC } = parseArgs({
			args: args.slice(3),
			options: {
				main: { type: "string", short: "m" },
				pkgPath: { type: "string", short: "p" },
				output: { type: "string", short: "o" },
				silent: { type: "boolean", short: "s" },
			},
		});

		return flagC;
	}

	static async promptConfig(defaults: Config): Promise<PartialConfig> {
		p.intro("Corpus config wizard");

		const main = await p.text({
			message: "Server entry file:",
			defaultValue: defaults.main,
			placeholder: defaults.main,
		});

		const output = await p.text({
			message: "Output file path:",
			defaultValue: defaults.output,
			placeholder: defaults.output,
		});

		const pkgPath = await p.text({
			message: "Corpus package path:",
			defaultValue: defaults.pkgPath,
			placeholder: defaults.pkgPath,
		});

		const casing = await p.select({
			message: "Type casing:",
			options: [
				{ label: "PascalCase", value: "pascal" },
				{ label: "camelCase", value: "camel" },
				{ label: "snake_case", value: "snake" },
			],
			initialValue: defaults.casing,
		});

		const exportClientAs = await p.text({
			message: "Export API client as:",
			defaultValue: defaults.exportClientAs,
			placeholder: defaults.exportClientAs,
		});

		const ignoreGlobalPrefix = await p.confirm({
			message: "Ignore global prefix for generated keys?",
			initialValue: defaults.ignoreGlobalPrefix,
		});

		const packageManager = await p.select({
			message: "Package manager:",
			options: ACCEPTED_PACKAGE_MANAGERS.map((pm) => ({
				label: pm,
				value: pm,
			})),
			initialValue: defaults.packageManager,
		});

		const validationLibrary = await p.select({
			message: "Validation library:",
			options: [
				...ACCEPTED_VALIDATION_LIBS.map((lib) => ({ label: lib, value: lib })),
				{ label: "none", value: "none" },
			],
			initialValue: "none",
		});

		const dbFilePath = await p.text({
			message: "Database file path (leave blank to skip):",
			defaultValue: "",
			placeholder: "leave blank to skip",
		});

		const silent = await p.confirm({
			message: "Suppress console output?",
			initialValue: defaults.silent,
		});

		// Handle cancellation (Ctrl+C on any prompt returns a symbol)
		const allAnswers = {
			main,
			output,
			pkgPath,
			casing,
			exportClientAs,
			ignoreGlobalPrefix,
			packageManager,
			validationLibrary,
			dbFilePath,
			silent,
		};
		if (Object.values(allAnswers).some((v) => p.isCancel(v))) {
			p.cancel("Config wizard cancelled.");
			process.exit(0);
		}

		p.outro("Config ready.");

		return {
			main: main as string,
			output: output as string,
			pkgPath: pkgPath as string,
			casing: casing as Config["casing"],
			exportClientAs: exportClientAs as string,
			ignoreGlobalPrefix: ignoreGlobalPrefix as boolean,
			packageManager: packageManager as Config["packageManager"],
			validationLibrary:
				validationLibrary === "none" ? null : (validationLibrary as Config["validationLibrary"]),
			silent: silent as boolean,
		};
	}

	static async getResolvedConfig(): Promise<Config> {
		const flagConfig = this.getFlagConfig();
		const fileConfig = this.getFileConfig();
		const defaultConfig = this.getDefaultConfig();

		function pick<K extends keyof Config>(
			key: K,
			...sources: (Partial<Config> | null | undefined)[]
		): Config[K] {
			for (const src of sources) {
				const v = src?.[key];
				if (v != null) return v as Config[K];
			}
			return defaultConfig[key];
		}

		const keys = Object.keys(defaultConfig) as (keyof Config)[];

		const mergedDefaults = Object.fromEntries(keys.map((k) => [k, pick(k, fileConfig)])) as Config;

		const hasFlags = keys.some((k) => flagConfig[k] != null);

		const promptConfig: PartialConfig = hasFlags
			? {}
			: this.configFileExists()
				? {}
				: await this.promptConfig(mergedDefaults);

		const config = Object.fromEntries(
			keys.map((k) => [k, pick(k, flagConfig, promptConfig, mergedDefaults)]),
		) as Config;

		if (config.silent) registerSilentConsole();

		return config;
	}
	static async writeConfigFile(config: Config) {
		if (this.configFileExists()) return;

		const f = new Formatter();

		const raw = `import { defineConfig } from "@ozanarslan/corpus-cli/config";

export default defineConfig({
    main: "${config.main}",
    pkgPath: "${config.pkgPath}",
    validationLibrary: ${config.validationLibrary ? `"${config.validationLibrary}"` : `null`},
    packageManager: "${config.packageManager ?? `bun`}",
    casing: "${config.casing}",
    output: "${config.output}",
    exportClientAs: "${config.exportClientAs}",
    exportModelsAs: "${config.exportModelsAs}",
    exportArgsAs: "${config.exportArgsAs}",
    exportEntitiesAs: "${config.exportEntitiesAs}",
    // The \`fallback: ctx => ctx.base\` strategy silently drops unsupported constraints and
    // keeps the rest of the schema intact. The least surprising behaviour for codegen purposes.
    jsonSchemaOptions: {
        target: "draft-07",
        fallback: (ctx: any) => ctx.base,
    },
});`;

		const content = await f.format(raw, "typescript");
		const fpath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
		fs.mkdirSync(path.dirname(fpath), { recursive: true });
		fs.writeFileSync(fpath, content);

		logger.info(`Config written to ${CONFIG_FILE_NAME}`);
	}

	static configFileExists() {
		const filePath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
		return fs.existsSync(filePath);
	}
}

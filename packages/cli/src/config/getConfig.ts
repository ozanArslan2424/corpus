import fs from "fs";
import path from "path";

import type { Config } from "@/config/Config";
import { CONFIG_FILE_NAME } from "@/constants";
import { cache } from "@/utils/cache";
import { isObject, isString } from "@/utils/is";
import { logger } from "@/utils/logger";
import { objGetEntries } from "@/utils/objects";
import { resolveCwdPath } from "@/utils/paths";
import { StringBuilder } from "@/utils/StringBuilder";
import { quote } from "@/utils/strings";

export function getDefaultConfig(): Config {
	return {
		silent: false,
		main: "./src/main.ts",
		pkgPath: "@ozanarslan/corpus",
		casing: "pascal",
		validationLibrary: null,
		output: "./src/corpus.gen.ts",
		apiClient: {
			disabled: false,
			exportAs: "CorpusApi",
			useStaticClass: false,
		},
		ignoreGlobalPrefix: false,
		defaultMethods: {
			get: { propertyKey: "get", address: "GET /" },
			getByParams: { propertyKey: "getByParams", address: "GET /:id" },
			create: { propertyKey: "create", address: "POST /" },
			update: { propertyKey: "update", address: "PUT /:id" },
			remove: { propertyKey: "remove", address: "DELETE /:id" },
		},
		folderStructure: {
			model: "{resource}/{resource}-model.ts",
			service: "{resource}/{resource}-service.ts",
			controller: "{resource}/{resource}-controller.ts",
			route: "{resource}/{resource}-route.ts",
		},
		exportModelsNamespace: true,
		exportArgsNamespace: true,
	};
}

function getFileConfig(): Config | null {
	const extensions = [".ts", ".js"];
	const base = resolveCwdPath(CONFIG_FILE_NAME.replace(".ts", ""));
	const configPath = extensions.map((ext) => base + ext).find(fs.existsSync);
	return configPath ? require(configPath).default : null;
}

export const getConfig = cache("getConfig", (): Config => {
	function configFileExists() {
		const filePath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
		return fs.existsSync(filePath);
	}

	const fileConfig = getFileConfig();
	const defaultConfig = getDefaultConfig();
	const config = fileConfig ?? defaultConfig;

	function writeConfigFile(config: Config) {
		const b = new StringBuilder();
		b.line(`import { defineConfig } from "@ozanarslan/corpus-cli/config";`);
		b.line(``);
		b.line(`export default defineConfig({`);
		writeConfigEntries(b, config, 1);
		b.line(`});`);
		const content = b.toString();
		const fpath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
		fs.mkdirSync(path.dirname(fpath), { recursive: true });
		fs.writeFileSync(fpath, content);
		logger.info(`Config written to ${CONFIG_FILE_NAME}`);
	}

	function writeConfigEntries(b: StringBuilder, obj: Record<string, any>, indent: number) {
		for (const [key, val] of objGetEntries(obj)) {
			if (isObject(val)) {
				b.line(indent)(`${key}: {`);
				writeConfigEntries(b, val, indent + 1);
				b.line(indent)(`},`);
			} else {
				b.line(indent)(`${key}: ${isString(val) ? quote(val) : val},`);
			}
		}
	}

	if (!configFileExists()) writeConfigFile(config);
	return config;
});

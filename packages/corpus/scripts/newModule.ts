import fs from "fs/promises";
import path from "path";

import { logFatal } from "@/utils/logger";

import {
	SCAFFOLD_EXTS,
	boilerplate,
	fileExists,
	parseGroupFlag,
	resolveGroupDir,
} from "./moduleScaffold";

async function newModule() {
	const args = process.argv.slice(2);
	const name = args.find((arg) => !arg.startsWith("-"));
	if (!name) {
		logFatal("Usage: new-module.ts <ModuleName> --group C|X|root");
	}

	const groupFlag = parseGroupFlag(args);
	if (groupFlag === "all") {
		logFatal('A single --group (C, X, or root) is required — "all" is not valid here.');
	}

	const groupDir = resolveGroupDir(groupFlag);
	const group = groupFlag === "root" ? null : groupFlag;
	const moduleDir = path.join(groupDir, name);

	if (await fileExists(moduleDir)) {
		logFatal(`Module directory already exists: ${moduleDir}`);
	}

	await fs.mkdir(moduleDir, { recursive: true });

	await fs.writeFile(
		path.join(moduleDir, "index.ts"),
		`${[name, `${name}.abstract`, `${name}.types`]
			.map((file) => `export * from "./${file}";`)
			.join("\n")}\n`,
		"utf8",
	);

	await fs.writeFile(
		path.join(moduleDir, `${name}.ts`),
		`import { ${name}Abstract } from "@${group ? `/${group}` : ``}/${name}/${name}.abstract";

export class ${name} extends ${name}Abstract {}`,
		"utf8",
	);

	await fs.writeFile(
		path.join(moduleDir, `${name}.abstract.ts`),
		`export abstract class ${name}Abstract {}`,
		"utf8",
	);

	for (const ext of SCAFFOLD_EXTS) {
		await fs.writeFile(path.join(moduleDir, `${name}.${ext}`), boilerplate(name, ext), "utf8");
	}

	const exportPath = `./${name}`;
	await fs.appendFile(path.join(groupDir, "index.ts"), `export * from "${exportPath}";\n`, "utf8");

	console.log(`Created module ${name} in ${moduleDir}`);
}

await newModule();

import fs from "fs/promises";
import path from "path";

import { logFatal } from "@/utils/logger";

import {
	abstractBoilerplate,
	barrelBoilerplate,
	concreteBoilerplate,
	docsBoilerplate,
	fileExists,
	parseGroupFlag,
	resolveGroupDir,
	sourceStems,
	testBoilerplate,
	typesBoilerplate,
} from "./utils";

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

	await fs.writeFile(path.join(moduleDir, "index.ts"), barrelBoilerplate(name), "utf8");

	await fs.writeFile(path.join(moduleDir, `${name}.ts`), concreteBoilerplate(group, name), "utf8");

	await fs.writeFile(
		path.join(moduleDir, `${name}.abstract.ts`),
		abstractBoilerplate(name),
		"utf8",
	);

	await fs.writeFile(path.join(moduleDir, `${name}.test.ts`), testBoilerplate(name), "utf8");
	await fs.writeFile(path.join(moduleDir, `${name}.types.ts`), typesBoilerplate(name), "utf8");

	for (const stem of sourceStems(name)) {
		await fs.writeFile(path.join(moduleDir, `${stem}.md`), docsBoilerplate(stem), "utf8");
	}

	const exportPath = `./${name}`;
	await fs.appendFile(path.join(groupDir, "index.ts"), `export * from "${exportPath}";\n`, "utf8");

	console.log(`Created module ${name} in ${moduleDir}`);
}

await newModule();

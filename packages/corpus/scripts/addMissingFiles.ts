import fs from "fs/promises";
import path from "path";

import {
	abstractBoilerplate,
	concreteBoilerplate,
	docsBoilerplate,
	fileExists,
	listModuleDirs,
	parseGroupFlag,
	resolveGroups,
	sourceStems,
	testBoilerplate,
	typesBoilerplate,
} from "./moduleScaffold";

async function addMissingFiles() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const groups = resolveGroups(parseGroupFlag(args));

	for (const group of groups) {
		const modules = await listModuleDirs(group);
		for (const mod of modules) {
			for (const ext of ["test.ts", "types.ts", "abstract.ts", "ts"]) {
				const fileName = `${mod.name}.${ext}`;
				const filePath = path.join(mod.dir, fileName);
				const exists = await fileExists(filePath);
				if (exists) continue;

				console.log(`[${group}] creating ${path.join(mod.name, fileName)}`);
				if (dryRun) continue;

				switch (ext) {
					case "test.ts":
						await fs.writeFile(filePath, testBoilerplate(mod.name), "utf8");
						break;

					case "types.ts":
						await fs.writeFile(filePath, typesBoilerplate(mod.name), "utf8");
						break;

					case "abstract.ts":
						await fs.writeFile(filePath, abstractBoilerplate(mod.name), "utf8");
						break;

					case "ts":
						await fs.writeFile(filePath, concreteBoilerplate(group, mod.name), "utf8");
						break;
				}
			}

			for (const stem of sourceStems(mod.name)) {
				const fileName = `${stem}.docs.md`;
				const filePath = path.join(mod.dir, fileName);
				const exists = await fileExists(filePath);
				if (exists) continue;

				console.log(`[${group}] creating ${path.join(mod.name, fileName)}`);
				if (dryRun) continue;
				await fs.writeFile(filePath, docsBoilerplate(stem), "utf8");
			}
		}
	}
}

await addMissingFiles();

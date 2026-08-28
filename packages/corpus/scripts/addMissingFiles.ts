import fs from "fs/promises";
import path from "path";

import {
	SCAFFOLD_EXTS,
	boilerplate,
	fileExists,
	listModuleDirs,
	parseGroupFlag,
	resolveGroups,
} from "./moduleScaffold";

async function addMissingFiles() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const groups = resolveGroups(parseGroupFlag(args));

	for (const group of groups) {
		const modules = await listModuleDirs(group);
		for (const mod of modules) {
			for (const ext of SCAFFOLD_EXTS) {
				const fileName = `${mod.name}.${ext}`;
				const filePath = path.join(mod.dir, fileName);
				const exists = await fileExists(filePath);
				if (exists) continue;

				console.log(`[${group}] creating ${path.join(mod.name, fileName)}`);
				if (dryRun) continue;
				await fs.writeFile(filePath, boilerplate(mod.name, ext), "utf8");
			}
		}
	}
}

await addMissingFiles();

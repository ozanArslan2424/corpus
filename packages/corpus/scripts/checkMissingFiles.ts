import path from "path";

import {
	expectedFiles,
	fileExists,
	listModuleDirs,
	parseGroupFlag,
	resolveGroups,
} from "./moduleScaffold";

async function checkMissingFiles() {
	const groups = resolveGroups(parseGroupFlag(process.argv.slice(2)));
	let missingCount = 0;

	for (const group of groups) {
		const modules = await listModuleDirs(group);
		for (const mod of modules) {
			const missing: Array<string> = [];
			for (const file of expectedFiles(mod.name)) {
				const exists = await fileExists(path.join(mod.dir, file));
				if (!exists) missing.push(file);
			}
			if (missing.length) {
				missingCount += missing.length;
				console.log(`[${group}] ${mod.name}: missing ${missing.join(", ")}`);
			}
		}
	}

	if (missingCount === 0) {
		console.log("No missing files.");
	}
}

await checkMissingFiles();

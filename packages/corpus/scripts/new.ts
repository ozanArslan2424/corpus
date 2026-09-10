import fs from "fs";
import path from "path";

import { assert } from "@/utils/assert";
import { logFatal, logger } from "@/utils/logger";

try {
	const address = process.argv[2];
	assert.present(address, "You need to provide an address for the generated module");

	const segments = address.split("/").filter(Boolean);
	assert(segments.length > 0, "Address needs to be a slash separated path");

	const name = segments[segments.length - 1];
	assert(name, "Address needs to be a slash separated path");

	const resolved = path.resolve("src", ...segments);

	fs.mkdirSync(resolved, { recursive: true });

	const mainPath = path.join(resolved, "index.ts");
	const mainContent = /^[A-Z]/.test(name)
		? `export class ${name} {};`
		: `export function ${name}() {};`;
	write(mainPath, mainContent);

	const testPath = path.join(resolved, "index.test.ts");
	const testContent = `// TODO: ${name} tests`;
	write(testPath, testContent);

	const docsPath = path.join(resolved, "index.md");
	const docsContent = `# ${name}`;
	write(docsPath, docsContent);

	logger.log("done");
} catch (err) {
	logFatal(String(err));
}

function write(fpath: string, content: string) {
	if (fs.existsSync(fpath)) {
		logger.log(`${fpath} exists, skipping.`);
		return;
	}
	fs.writeFileSync(fpath, content);
}

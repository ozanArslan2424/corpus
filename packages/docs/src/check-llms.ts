import fs from "fs";
import path from "path";

// Run with:  bun ./src/check-llms.ts <filesDir> <llms-full.txt path>
// e.g.:      bun ./src/check-llms.ts ./src/files ./public/llms-full.txt

const [filesDirArg, llmsFullPathArg] = process.argv.slice(2);
if (!filesDirArg || !llmsFullPathArg) {
	console.error("Usage: bun ./src/check-llms.ts <filesDir> <llms-full.txt path>");
	process.exit(1);
}

const filesDir = path.resolve(filesDirArg);
const llmsFullPath = path.resolve(llmsFullPathArg);

function walkMdFiles(dir: string): Array<string> {
	const out: Array<string> = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...walkMdFiles(full));
		} else if (entry.isFile() && full.endsWith(".md")) {
			out.push(full);
		}
	}
	return out;
}

const mdFiles = walkMdFiles(filesDir);
const llmsFull = fs.readFileSync(llmsFullPath, "utf8");

// 1. Every source .md file's raw content must appear verbatim in llms-full.txt
const missing: Array<string> = [];
let totalMdBytes = 0;

for (const fpath of mdFiles) {
	const raw = fs.readFileSync(fpath, "utf8").trim();
	totalMdBytes += Buffer.byteLength(raw, "utf8");
	if (!llmsFull.includes(raw)) {
		missing.push(path.relative(filesDir, fpath));
	}
}

// 2. Page count sanity check — count "---" separators
const sectionCount = llmsFull.split("\n\n---\n\n").length;

console.log(`Source .md files found:        ${mdFiles.length}`);
console.log(`Sections in llms-full.txt:     ${sectionCount}`);
console.log(`Total raw .md bytes:           ${totalMdBytes}`);
console.log(`llms-full.txt bytes:           ${Buffer.byteLength(llmsFull, "utf8")}`);
console.log(
	`llms-full.txt overhead (headings, separators): ${Buffer.byteLength(llmsFull, "utf8") - totalMdBytes} bytes`,
);

if (mdFiles.length !== sectionCount) {
	console.log(
		`\n⚠ MISMATCH: ${mdFiles.length} source files but ${sectionCount} sections in llms-full.txt`,
	);
} else {
	console.log(`\n✓ Section count matches file count`);
}

if (missing.length > 0) {
	console.log(`\n⚠ ${missing.length} file(s) not found verbatim in llms-full.txt:`);
	for (const f of missing) console.log(`  - ${f}`);
} else {
	console.log(`✓ All source .md content found verbatim in llms-full.txt`);
}

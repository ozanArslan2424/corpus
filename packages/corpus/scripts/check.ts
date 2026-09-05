import fs from "fs";
import path from "path";

import { logger } from "@/utils/logger";

const GIT_IGNORE = ".gitignore";
const IGNORE: Array<string> = [".git", "node_modules", "utils", "test", "scripts"];
const WRITE = process.argv.slice(2).some((arg) => arg === "--write" || arg === "-w");

const KINDS = ["e2e", "ts", "test"] as const;
type Kinds = typeof KINDS;
type Kind = Kinds[number];

const EXCLUDED_DIR_SUFFIXES = ["corpus", "src"];
const KIND_SUFFIXES: Array<{ kind: Kind; suffix: string }> = [
	{ kind: "e2e", suffix: ".e2e.test.ts" },
	{ kind: "test", suffix: ".test.ts" },
	{ kind: "ts", suffix: ".ts" },
];

interface DirInfo {
	present: Record<Kind, boolean>;
	emptyPaths: Record<Kind, Array<string>>;
}

const DIR_INFO = new Map<string, DirInfo>();

class Entry {
	constructor(dir: string, dirent: fs.Dirent) {
		this.dirent = dirent;
		this.fpath = path.join(dir, dirent.name);
	}

	dirent: fs.Dirent;
	fpath: string;
	get stats(): fs.Stats {
		return fs.statSync(this.fpath);
	}

	get ext(): string {
		return path.extname(this.dirent.name);
	}

	isEmpty(): boolean {
		if (this.stats.isDirectory()) {
			return fs.readdirSync(this.fpath).length === 0;
		}
		return this.stats.size === 0;
	}
}

function isIgnored(name: string): boolean {
	return IGNORE.some((pattern) => {
		// Clean pattern trailing slashes for simple string checking
		const cleanPattern = pattern.replace(/\/$/, "");
		if (name === cleanPattern) return true;

		// Convert basic glob wildcard to regex safely
		const regexPattern = cleanPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
		return new RegExp(`^${regexPattern}$`).test(name);
	});
}

function walk(
	dir: string,
	cbs: { onDirectory?: (entry: Entry) => void; onFile?: (entry: Entry) => void },
) {
	function _walk(_dir: string) {
		const dirents = fs.readdirSync(_dir, { withFileTypes: true });
		for (const dirent of dirents) {
			if (isIgnored(dirent.name)) continue;

			const entry = new Entry(_dir, dirent);

			if (dirent.isDirectory()) {
				cbs.onDirectory?.(entry);
				_walk(entry.fpath);
			} else {
				cbs.onFile?.(entry);
			}
		}
	}

	_walk(path.resolve(dir));
}

function makeDirInfo(): DirInfo {
	return {
		present: { e2e: false, ts: false, test: false },
		emptyPaths: { e2e: [], ts: [], test: [] },
	};
}

function logByKind(title: string, collect: (kind: Kind) => Array<string>) {
	logger.log(title);
	for (const kind of KINDS) {
		const items = collect(kind);
		if (items.length === 0) continue;
		logger.log(`\n${kind} (${items.length}):`);
		for (const item of items) logger.log(`  ${item}`);
	}
}

function getEmpty(kind: Kind): Array<string> {
	return [...DIR_INFO.values()].flatMap((info) => info.emptyPaths[kind]);
}

function getMissing(kind: Kind): Array<string> {
	return [...DIR_INFO.entries()]
		.filter(([dir]) => !EXCLUDED_DIR_SUFFIXES.some((s) => dir.endsWith(s)))
		.filter(([, info]) => !info.present[kind])
		.map(([dir]) => {
			const { suffix } = KIND_SUFFIXES.find((s) => s.kind === kind)!;
			return path.join(dir, `index${suffix}`);
		});
}

function main() {
	const gitIgnoreExists = fs.existsSync(GIT_IGNORE);
	if (gitIgnoreExists) {
		const gitIgnore = fs.readFileSync(GIT_IGNORE, "utf8");
		for (const line of gitIgnore.split("\n")) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith("#")) {
				IGNORE.push(trimmed);
			}
		}
	}

	walk(".", {
		onFile(entry) {
			const match = KIND_SUFFIXES.find(({ suffix }) => entry.dirent.name.endsWith(suffix));
			if (!match) return;
			const { kind } = match;
			const dir = path.dirname(entry.fpath);
			const info = DIR_INFO.get(dir) ?? makeDirInfo();
			info.present[kind] = true;
			if (entry.isEmpty()) info.emptyPaths[kind].push(entry.fpath);
			DIR_INFO.set(dir, info);
		},
	});

	logByKind("Empty Files:", getEmpty);
	logByKind("\nMissing Files:", getMissing);

	if (WRITE) {
		logByKind("\nWritten Files:", (kind) => {
			return getMissing(kind).map((fpath) => {
				fs.writeFileSync(fpath, "", { flag: "wx" });
				return fpath;
			});
		});
	}
}

main();

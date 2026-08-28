import fs from "fs/promises";
import path from "path";

import { logFatal } from "@/utils/logger";

export const SRC_DIR = "./src";
export const GROUPS = ["C", "X", "root"] as const;
export type Group = (typeof GROUPS)[number];

export function resolveGroupDir(group: Group): string {
	return group === "root" ? SRC_DIR : path.join(SRC_DIR, group);
}

export async function listModuleDirs(group: Group): Promise<Array<{ name: string; dir: string }>> {
	const groupDir = resolveGroupDir(group);
	const entries = await fs.readdir(groupDir, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.filter((entry) => (group === "root" ? !GROUPS.includes(entry.name as Group) : true))
		.map((entry) => ({ name: entry.name, dir: path.join(groupDir, entry.name) }));
}

export function expectedFiles(name: string): Array<string> {
	return [
		"index.ts",
		`${name}.ts`,
		`${name}.abstract.ts`,
		`${name}.docs.md`,
		`${name}.test.ts`,
		`${name}.types.ts`,
	];
}

export const SCAFFOLD_EXTS = ["docs.md", "test.ts", "types.ts"] as const;
export type ScaffoldExt = (typeof SCAFFOLD_EXTS)[number];

export function boilerplate(name: string, ext: ScaffoldExt): string {
	switch (ext) {
		case "docs.md":
			return `
---
toc:
  - title: Title1
    url: "#title1"
  - title: Title2
    url: "#title2"
  - title: Title3
    url: "#title3"
---

# ${name}

explanation

## Extends x, y

This object extends [x](/x) which itself extends [y](/y).

## Title1

explanation

### example or subtitle

explanation or code block

## Title2

### example or subtitle

explanation or code block

## Title3

### example or subtitle

explanation or code block
			`.trim();
		case "test.ts":
			return `
import { afterEach, describe, expect, it } from "bun:test";
import { createTestServer } from "#testutils";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());
const s = createTestServer();

describe("${name}", () => {});
	`.trim();
		case "types.ts":
			return `// TODO: define types for ${name}\n`;
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	return fs.exists(filePath);
}

export function parseGroupFlag(argv: Array<string>): Group | "all" {
	const idx = argv.findIndex((arg) => arg === "--group" || arg === "-g");
	const value = idx !== -1 ? argv[idx + 1] : undefined;
	if (!value || value === "all") return "all";
	if (!GROUPS.includes(value as Group)) {
		logFatal(`Invalid group "${value}". Expected one of: ${GROUPS.join(", ")}, all`);
	}
	return value as Group;
}

export function resolveGroups(flag: Group | "all"): Array<Group> {
	return flag === "all" ? [...GROUPS] : [flag];
}

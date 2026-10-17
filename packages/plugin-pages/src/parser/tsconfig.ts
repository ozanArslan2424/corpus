import fs from "node:fs";
import path from "node:path";

import { isPresent, type Nullable } from "@/utils/is";
import { memo } from "@/utils/memo";

/**
 * The tsconfig.json at or above `dir` — the nearest one by default, or the outermost within the
 * package when `stopAtPackageRoot` is set.
 */
function findTsConfig(dir: string, stopAtPackageRoot = false): Nullable<string> {
	let current = path.resolve(dir);
	let found: Nullable<string> = null;

	while (true) {
		const file = path.join(current, "tsconfig.json");
		if (fs.existsSync(file)) {
			found = file;
			if (!stopAtPackageRoot) return found;
		}

		const atPackageRoot = stopAtPackageRoot && fs.existsSync(path.join(current, "package.json"));
		const parent = path.dirname(current);
		if (atPackageRoot || parent === current) return found;
		current = parent;
	}
}

export interface TsConfigPaths {
	paths: Record<string, Array<string>>;
	/** The directory `paths` targets are relative to: `baseUrl` if set, else the tsconfig that declares `paths`. */
	pathsBase: string;
}

interface RawTsConfig {
	extends?: string | Array<string>;
	compilerOptions?: { baseUrl?: string; outDir?: string; paths?: Record<string, Array<string>> };
}

interface ResolvedOptions {
	declaredPaths?: TsConfigPaths;
	baseUrl?: string;
	outDir?: string;
}

function resolveExtendsFilePath(entry: string, dir: string): string {
	if (entry.startsWith(".") || path.isAbsolute(entry)) {
		const file = path.resolve(dir, entry);
		return file.endsWith(".json") ? file : `${file}.json`;
	}
	return Bun.resolveSync(entry, dir);
}

/** `paths` and `baseUrl` from `file`, following `extends`; later configs override earlier ones, as in TypeScript. */
const readTsConfig = memo((file: string): ResolvedOptions => {
	const config = Bun.JSONC.parse(fs.readFileSync(file, "utf8")) as RawTsConfig;
	const dir = path.dirname(file);
	let result: ResolvedOptions = {};

	for (const entry of [config.extends ?? []].flat()) {
		const extendedConfig = resolveExtendsFilePath(entry, dir);
		result = { ...result, ...readTsConfig(extendedConfig) };
	}

	const options = config.compilerOptions ?? {};
	if (isPresent(options.baseUrl)) result.baseUrl = path.resolve(dir, options.baseUrl);
	if (isPresent(options.outDir)) result.outDir = path.resolve(dir, options.outDir);
	if (isPresent(options.paths)) result.declaredPaths = { paths: options.paths, pathsBase: dir };

	return result;
});

/**
 * The `paths` of the tsconfig.json nearest to `fromDir` (at or above it), with `extends` followed.
 * `null` when there's no tsconfig, or it declares no `paths`.
 */
export function getTsConfigPaths(fromDir: string): Nullable<TsConfigPaths> {
	const file = findTsConfig(fromDir);
	if (!file) return null;

	const config = readTsConfig(file);
	if (!config.declaredPaths) return null;

	return {
		paths: config.declaredPaths.paths,
		pathsBase: config.baseUrl ?? config.declaredPaths.pathsBase,
	};
}

/**
 * The absolute `outDir` of the project's tsconfig.json — the outermost one at or above `fromDir`,
 * with `extends` followed. Defaults to `dist` beside that tsconfig when none is declared.
 * `null` when there's no tsconfig.
 */
export function getTsConfigOutDir(fromDir: string): string {
	const file = findTsConfig(fromDir, true);
	if (file) {
		const { outDir } = readTsConfig(file);
		if (outDir) return outDir;
	}

	return path.join(fromDir, "dist");
}

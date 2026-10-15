import fs from "node:fs";
import path from "node:path";

import { isPresent, type Nullable } from "@/utils/is";

export interface TsConfigPaths {
	paths: Record<string, Array<string>>;
	/** The directory `paths` targets are relative to: `baseUrl` if set, else the tsconfig that declares `paths`. */
	pathsBase: string;
}

interface RawTsConfig {
	extends?: string | Array<string>;
	compilerOptions?: { baseUrl?: string; paths?: Record<string, Array<string>> };
}

interface ResolvedOptions {
	declaredPaths?: TsConfigPaths;
	baseUrl?: string;
}

function resolveExtendsFilePath(entry: string, dir: string): string {
	if (entry.startsWith(".") || path.isAbsolute(entry)) {
		const file = path.resolve(dir, entry);
		return file.endsWith(".json") ? file : `${file}.json`;
	}
	return Bun.resolveSync(entry, dir);
}

/** `paths` and `baseUrl` from `file`, following `extends`; later configs override earlier ones, as in TypeScript. */
function readTsConfig(file: string): ResolvedOptions {
	const config = Bun.JSONC.parse(fs.readFileSync(file, "utf8")) as RawTsConfig;
	const dir = path.dirname(file);
	let result: ResolvedOptions = {};

	for (const entry of [config.extends ?? []].flat()) {
		const extendedConfig = resolveExtendsFilePath(entry, dir);
		result = { ...result, ...readTsConfig(extendedConfig) };
	}

	const options = config.compilerOptions ?? {};
	if (isPresent(options.baseUrl)) result.baseUrl = path.resolve(dir, options.baseUrl);
	if (isPresent(options.paths)) result.declaredPaths = { paths: options.paths, pathsBase: dir };
	return result;
}

function findTsConfig(dir: string): Nullable<string> {
	const file = path.join(dir, "tsconfig.json");
	// found directly
	if (fs.existsSync(file)) return file;

	// check parent
	const parent = path.dirname(dir);
	return parent === dir ? null : findTsConfig(parent);
}

/**
 * The `paths` of the tsconfig.json nearest to `fromDir` (at or above it), with `extends` followed.
 * `null` when there's no tsconfig, or it declares no `paths`.
 */
export function getTsConfigPaths(fromDir: string): Nullable<TsConfigPaths> {
	const file = findTsConfig(path.resolve(fromDir));
	if (!file) return null;

	const config = readTsConfig(file);
	if (!config.declaredPaths) return null;

	return {
		paths: config.declaredPaths.paths,
		pathsBase: config.baseUrl ?? config.declaredPaths.pathsBase,
	};
}

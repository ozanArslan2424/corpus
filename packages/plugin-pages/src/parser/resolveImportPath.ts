import fs from "fs";
import path from "path";

import type { TsConfigPaths } from "@/parser/tsconfig";
import type { Nullable } from "@/utils/is";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

/** The file `base` refers to: itself, with an extension added, its `index` file, or `.js` written for a `.ts` file. */
function findFile(base: string): Nullable<string> {
	const candidates = [
		base,
		...EXTENSIONS.map((ext) => base + ext),
		...EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
		// TS ESM style: `./a.js` in source for `./a.ts` on disk.
		...(/\.[cm]?jsx?$/.test(base)
			? [".ts", ".tsx"].map((ext) => base.replace(/\.[cm]?jsx?$/, ext))
			: []),
	];
	return (
		candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ??
		null
	);
}

/** Targets of the `paths` pattern that matches `specifier`, longest prefix first, as TypeScript picks them. */
function pathsTargets(specifier: string, paths: Record<string, Array<string>>): Array<string> {
	let best: { prefixLength: number; targets: Array<string> } | null = null;

	for (const [pattern, targets] of Object.entries(paths)) {
		const star = pattern.indexOf("*");
		if (star === -1) {
			if (pattern === specifier) return targets;
			continue;
		}
		const prefix = pattern.slice(0, star);
		const suffix = pattern.slice(star + 1);
		if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
		if (best && best.prefixLength >= prefix.length) continue;

		const matched = specifier.slice(prefix.length, specifier.length - suffix.length);
		best = {
			prefixLength: prefix.length,
			targets: targets.map((target) => target.replace("*", matched)),
		};
	}

	return best?.targets ?? [];
}

/**
 * The absolute file an import in `importer` refers to: relative imports and tsconfig `paths` aliases are resolved
 * here; anything else (packages, `node:` builtins) goes through Bun's resolver. `null` when nothing is found.
 */
export function resolveImportPath(
	specifier: string,
	importer: string,
	tsconfigPaths: Nullable<TsConfigPaths>,
): Nullable<string> {
	if (specifier.startsWith("./") || specifier.startsWith("../") || path.isAbsolute(specifier)) {
		return findFile(path.resolve(path.dirname(importer), specifier));
	}

	if (tsconfigPaths) {
		for (const target of pathsTargets(specifier, tsconfigPaths.paths)) {
			const file = findFile(path.resolve(tsconfigPaths.pathsBase, target));
			if (file) return file;
		}
	}

	try {
		return Bun.resolveSync(specifier, path.dirname(importer));
	} catch {
		return null;
	}
}

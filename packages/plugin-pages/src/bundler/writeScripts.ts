import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Manifest } from "@/bundler/writeManifest";
import { collectReferencedStatements } from "@/parser/collectReferencedStatements";
import { extractFunctionBody } from "@/parser/extractFunctionBody";
import { parseTopLevelStatements, type Statement } from "@/parser/parseTopLevelStatements";
import { resolveImportPath } from "@/parser/resolveImportPath";
import { getTsConfigPaths, type TsConfigPaths } from "@/parser/tsconfig";
import { getRenderable } from "@/runtime/registry";
import { isAbsent, type Nullable } from "@/utils/is";

const CHUNK_PFX = "chunk";

/**
 * The statement's source with the types stripped: `const hello: string = "world";` → `const hello = "world";`.
 * Empty for type-only statements (`type`, `interface`, `import type`).
 */
function stripTypes(statement: { text: string }, loader: "ts" | "tsx" = "ts"): string {
	return new Bun.Transpiler({ loader }).transformSync(statement.text).trim();
}

/**
 * A referenced statement as it goes into the shared module: types stripped, `export` dropped (the shared module
 * exports everything in one list), and import specifiers rewritten to absolute paths so they resolve from anywhere.
 * Empty for type-only statements.
 */
function rewriteForSharedModule(
	statement: Statement,
	file: string,
	tsconfigPaths: Nullable<TsConfigPaths>,
): string {
	const text = stripTypes(statement, file.endsWith(".tsx") ? "tsx" : "ts");
	if (statement.keyword !== "import") return text.replace(/^export\s+(default\s+)?/, "");

	return text.replace(
		/(from\s*)(["'])([^"']+)\2/,
		(_, from: string, _quote: string, specifier: string) => {
			const resolved = resolveImportPath(specifier, file, tsconfigPaths);
			if (!resolved) throw new Error(`Can't resolve "${specifier}" imported in ${file}`);
			return `${from}${JSON.stringify(resolved)}`;
		},
	);
}

/** The script file: imports from the shared module, then the function body as an IIFE. */
function buildEntrypoint(script: Function, names: Array<string>): string {
	const isAsync = script.constructor.name === "AsyncFunction";
	const imports = names.length > 0 ? `import {${names.join(",")}} from "./${CHUNK_PFX}.js";` : "";
	return `${imports}(${isAsync ? "async " : ""}()=>{\n${extractFunctionBody(script)}})();`;
}

/**
 * Builds every script into `outdir` as `<name>.js`:
 * 1. reads each script's body,
 * 2. finds the top-level statements of its file the body reaches, transitively,
 * 3. copies them, types stripped, into one shared module (each name once),
 * 4. writes each script as an IIFE importing what it uses from the shared module,
 * 5. bundles the scripts with code splitting, so the shared code becomes one chunk.
 * Returns each script's bundled output by name. Scripts are ES modules: load them with `type="module"`.
 */
export async function writeScripts(manifest: Manifest, outdir: string) {
	const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-scripts-"));

	try {
		await fs.mkdir(outdir, { recursive: true });

		// Shared declarations by name, and their texts in emit order (destructured names share one text).
		const sharedByName = new Map<string, string>();
		const sharedTexts: Array<string> = [];
		const entrypoints: Array<string> = [];

		for (const script of manifest.scripts) {
			const renderable = getRenderable(script.ref);
			if (isAbsent(renderable)) continue;
			if (isAbsent(renderable.script)) continue;

			const statements = parseTopLevelStatements(await fs.readFile(renderable.src, "utf8"));
			const referenced = collectReferencedStatements(
				extractFunctionBody(renderable.script),
				statements,
			);
			const tsconfigPaths = getTsConfigPaths(path.dirname(renderable.src));
			const names: Array<string> = [];

			for (const stmt of referenced) {
				if (stmt.keyword === null || stmt.name === null) continue;
				const text = rewriteForSharedModule(stmt, renderable.src, tsconfigPaths);
				if (!text) continue;

				const existing = sharedByName.get(stmt.name);
				if (existing !== undefined && existing !== text) {
					throw new Error(
						`"${stmt.name}" is declared differently in two script modules (one is ${renderable.src}); rename one`,
					);
				}
				if (existing === undefined) {
					sharedByName.set(stmt.name, text);
					if (!sharedTexts.includes(text)) sharedTexts.push(text);
				}
				names.push(stmt.name);
			}

			const entry = path.join(workdir, `${renderable.ref}.js`);
			await fs.writeFile(entry, buildEntrypoint(renderable.script, names));
			entrypoints.push(entry);
		}

		await fs.writeFile(
			path.join(workdir, `${CHUNK_PFX}.js`),
			`${sharedTexts.join("\n")}\n\nexport { ${[...sharedByName.keys()].join(", ")} };\n`,
		);

		const build = await Bun.build({
			entrypoints,
			outdir,
			target: "browser",
			splitting: true,
			naming: { entry: "[name].[ext]", chunk: `chunks/${CHUNK_PFX}-[hash].[ext]` },
			minify: true,
			throw: false,
		});

		if (!build.success) throw new AggregateError(build.logs, "bundle failed");
	} finally {
		await fs.rm(workdir, { recursive: true, force: true });
	}
}

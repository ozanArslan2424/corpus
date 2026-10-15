import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ClientScript } from "@/definitions/Renderable";
import { functionBody } from "@/parser/functionBody";
import { referencedStatements } from "@/parser/referencedStatements";
import { resolveImportPath } from "@/parser/resolveImportPath";
import { topLevelStatements, type Statement } from "@/parser/topLevelStatements";
import { getTsConfigPaths, type TsConfigPaths } from "@/parser/tsconfig";
import type { Nullable } from "@/utils/is";

/** A script to build: its output name, the file it was defined in, and the function itself. */
export interface ScriptSource {
	name: string;
	file: string;
	script: ClientScript;
}

const CHUNK_PFX = "chunk";

/**
 * The statement's source with the types stripped: `const hello: string = "world";` → `const hello = "world";`.
 * Empty for type-only statements (`type`, `interface`, `import type`).
 */
function copyStatement(statement: { text: string }, loader: "ts" | "tsx" = "ts"): string {
	return new Bun.Transpiler({ loader }).transformSync(statement.text).trim();
}

/**
 * A referenced statement as it goes into the shared module: types stripped, `export` dropped (the shared module
 * exports everything in one list), and import specifiers rewritten to absolute paths so they resolve from anywhere.
 * Empty for type-only statements.
 */
function sharedStatement(
	statement: Statement,
	file: string,
	tsconfigPaths: Nullable<TsConfigPaths>,
): string {
	const text = copyStatement(statement, file.endsWith(".tsx") ? "tsx" : "ts");
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
function scriptFile(script: ClientScript, names: Array<string>): string {
	const isAsync = script.constructor.name === "AsyncFunction";
	const imports =
		names.length > 0 ? `import { ${names.join(", ")} } from "./${CHUNK_PFX}.js";\n\n` : "";
	return `${imports}(${isAsync ? "async " : ""}() => {\n${functionBody(script)}\n})();\n`;
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
export async function bundleScripts(
	sources: Array<{ name: string; file: string; script: ClientScript }>,
	outdir: string,
): Promise<Map<string, string>> {
	if (sources.length === 0) return new Map();

	const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-scripts-"));

	// Shared declarations by name, and their texts in emit order (destructured names share one text).
	const sharedByName = new Map<string, string>();
	const sharedTexts: Array<string> = [];
	const entrypoints: Array<string> = [];

	for (const source of sources) {
		const statements = topLevelStatements(await fs.readFile(source.file, "utf8"));
		const referenced = referencedStatements(functionBody(source.script), statements);
		const tsconfigPaths = getTsConfigPaths(path.dirname(source.file));
		const names: Array<string> = [];

		for (const statement of referenced) {
			if (statement.keyword === null || statement.name === null) continue;
			const text = sharedStatement(statement, source.file, tsconfigPaths);
			if (!text) continue;

			const existing = sharedByName.get(statement.name);
			if (existing !== undefined && existing !== text) {
				throw new Error(
					`"${statement.name}" is declared differently in two script modules (one is ${source.file}); rename one`,
				);
			}
			if (existing === undefined) {
				sharedByName.set(statement.name, text);
				if (!sharedTexts.includes(text)) sharedTexts.push(text);
			}
			names.push(statement.name);
		}

		const entry = path.join(workdir, `${source.name}.js`);
		await fs.writeFile(entry, scriptFile(source.script, names));
		entrypoints.push(entry);
	}

	await fs.writeFile(
		path.join(workdir, `${CHUNK_PFX}.js`),
		`${sharedTexts.join("\n")}\n\nexport { ${[...sharedByName.keys()].join(", ")} };\n`,
	);

	try {
		const build = await Bun.build({
			entrypoints,
			outdir,
			target: "browser",
			splitting: true,
			naming: { entry: "[name].[ext]", chunk: `chunks/${CHUNK_PFX}-[hash].[ext]` },
			minify: true,
			throw: false,
		});
		if (!build.success) {
			for (const log of build.logs) {
				console.error(log);
			}
			process.exit(1);
		}

		const outputs = new Map<string, string>();
		for (const output of build.outputs) {
			if (output.kind === "entry-point")
				outputs.set(path.parse(output.path).name, await output.text());
		}
		return outputs;
	} catch (err) {
		console.error(String(err), entrypoints);
		if (err instanceof Error) console.log(err.stack);
		process.exit(1);
	} finally {
		await fs.rm(workdir, { recursive: true, force: true });
	}
}

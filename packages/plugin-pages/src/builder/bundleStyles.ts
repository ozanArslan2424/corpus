import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Bundles each stylesheet into `outdir` as `<name>.css`. Returns each one's output by name. */
export async function bundleStyles(
	sources: Array<{ name: string; css: string }>,
	outdir: string,
): Promise<Map<string, string>> {
	if (sources.length === 0) return new Map();

	const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-styles-"));
	try {
		const entrypoints = await Promise.all(
			sources.map(async (source) => {
				const entry = path.join(workdir, `${source.name}.css`);
				await Bun.write(entry, source.css);
				return entry;
			}),
		);

		const build = await Bun.build({
			entrypoints,
			outdir,
			naming: "[name].[ext]",
			minify: true,
			throw: false,
		});
		if (!build.success) throw new AggregateError(build.logs, "Style build failed");

		const outputs = new Map<string, string>();
		for (const output of build.outputs)
			outputs.set(path.parse(output.path).name, await output.text());
		return outputs;
	} finally {
		await fs.rm(workdir, { recursive: true, force: true });
	}
}

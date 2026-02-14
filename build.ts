import type { BuildConfig } from "bun";
import dts from "bun-plugin-dts";

async function build() {
	const defaultBuildConfig: BuildConfig = {
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		target: "bun",
		sourcemap: "external",
	};

	await Bun.spawn(["tsc", "-p", "tsconfig.build.json"]).exited;

	await Promise.all([
		Bun.build({
			...defaultBuildConfig,
			plugins: [dts()],
			format: "esm",
			naming: "[dir]/[name].js",
		}),
		Bun.build({
			...defaultBuildConfig,
			format: "cjs",
			naming: "[dir]/[name].cjs",
		}),
	]);
}

build();

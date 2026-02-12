// import type { BuildConfig } from "bun";
// import dts from "bun-plugin-dts";
//
// const defaultBuildConfig: BuildConfig = {
// 	entrypoints: ["./src/index.ts"],
// 	outdir: "./dist",
// };
//
// await Promise.all([
// 	Bun.build({
// 		...defaultBuildConfig,
// 		plugins: [dts()],
// 		format: "esm",
// 		naming: "[dir]/[name].js",
// 	}),
// 	Bun.build({
// 		...defaultBuildConfig,
// 		format: "cjs",
// 		naming: "[dir]/[name].cjs",
// 	}),
// ]);
import type { BuildConfig } from "bun";
import dts from "bun-plugin-dts";

async function build() {
	const defaultBuildConfig: BuildConfig = {
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		target: "node", // Optional: specify target
		sourcemap: "external", // Optional: for source maps
	};

	// First, generate TypeScript declarations
	await Bun.spawn(["tsc", "-p", "tsconfig.build.json"]).exited;

	// Then build ESM and CJS bundles
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

import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/utils/index.ts"],
	outDir: "dist",
	format: ["esm"],
	unbundle: true,
	clean: true,
	minify: true,
	sourcemap: true,
	exports: true,
	deps: {
		alwaysBundle: ["@standard-schema/spec"],
	},
	dts: {
		generator: "tsc",
	},
});

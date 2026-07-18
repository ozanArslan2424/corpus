import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/cli.ts"],
	outDir: "dist",
	format: ["esm"],
	dts: true,
	clean: true,
	// minify: true,
	// sourcemap: true,
	exports: {
		bin: { corpus: "./src/cli.ts" },
	},
});

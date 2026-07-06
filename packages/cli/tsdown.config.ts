import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/config.ts", "./src/generateApiClient/ApiClientGenerator.ts"],
	outDir: "dist",
	format: ["esm"],
	dts: true,
	clean: true,
	// minify: true,
	// sourcemap: true,
	exports: {
		bin: { corpus: "./src/index.ts" },
	},
});

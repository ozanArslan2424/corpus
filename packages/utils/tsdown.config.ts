import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/*"],
	outDir: "dist",
	format: ["esm"],
	dts: true,
	clean: true,
	minify: true,
	exports: true,
});

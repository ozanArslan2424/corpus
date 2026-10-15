import { defineConfig } from "tsdown";

export default defineConfig([
	{
		entry: ["./src/index.ts", "./src/server.ts"],
		outDir: "dist",
		format: ["esm"],
		dts: true,
		clean: false,
		exports: true,
	},
	{
		// The client router every full page loads, prebuilt so consumers don't bundle it at runtime.
		entry: { router: "./src/browser/start.ts" },
		outDir: "dist",
		format: ["esm"],
		platform: "browser",
		minify: true,
		dts: false,
		clean: false,
	},
]);

import { defineConfig } from "@ozanarslan/corpus-cli/config";

export default defineConfig({
	main: "./test/other/startServer.ts",
	pkgPath: "@ozanarslan/corpus",
	validationLibrary: null,
	packageManager: "bun",
	casing: "pascal",
	output: "./test/other/generated.ts",
	exportClientAs: "CorpusApi",
	exportModelsAs: "Models",
	exportArgsAs: "Args",
	// The `fallback: ctx => ctx.base` strategy silently drops unsupported constraints and
	// keeps the rest of the schema intact. The least surprising behaviour for codegen purposes.
	jsonSchemaOptions: {
		target: "draft-07",
		fallback: (ctx: any) => ctx.base,
	},
});

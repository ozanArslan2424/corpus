import { defineConfig } from "@/config/defineConfig";

export default defineConfig({
	silent: false,
	main: "./test/app/main.ts",
	output: "./test/app/CorpusApi.ts",
	validationLibrary: "arktype",
});

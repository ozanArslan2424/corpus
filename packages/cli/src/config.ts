import type { OrString } from "@/utils/strings";

export type Config = {
	/**
	 * Suppress console logs.
	 *
	 * @default false
	 */
	silent: boolean;

	/**
	 * The server entrypoint file path.
	 *
	 * @default "./src/main.ts"
	 */
	main: string;

	/**
	 * The corpus package path.
	 *
	 * @default "@ozanarslan/corpus"
	 */
	pkgPath: string;

	/**
	 * Casing for file and directory names,
	 *
	 * @default "pascal"
	 */
	casing: "pascal" | "camel" | "kebab";

	/**
	 * Validation Library to generate models using.
	 * Append version number with @ if you need a specific version.
	 *
	 * Default versions:
	 * arktype: "2.2.0"
	 * yup: "1.7.1"
	 * zod: "4.3.6"
	 *
	 * @default null
	 */
	validationLibrary: "arktype" | "zod" | "yup" | null;

	/**
	 * Package manager to install any missing dependencies with.
	 * Also picks up from package.json
	 * Default is bun since corpus uses bun runtime.
	 *
	 * @default "bun"
	 */
	packageManager: "bun" | "pnpm" | "npm" | null;

	/**
	 * The file path where the generated output will be written.
	 *
	 * @default "./src/corpus.gen.ts"
	 */
	output: string;

	/**
	 * Controls how the API Client is exported.
	 * Set to false if you don't want the api client.
	 *
	 * @default "CorpusApi"
	 */
	exportClientAs: string;

	/**
	 * Controls how generated model types are exported.
	 *
	 * Pass a plain string to use it as a namespace that wraps all models.
	 * Pass a string containing `$` to export each model individually, with `$`
	 * replaced by the model's name.
	 *
	 * @default "Models"
	 *
	 * @example
	 * // Namespace mode (no `$`):
	 * exportModelsAs: "Models"
	 * // → Models.UsersGet
	 * // → Models.UsersIdGet
	 *
	 * @example
	 * // Template mode (with `$`):
	 * exportModelsAs: "Model$"
	 * // → ModelUsersGet
	 * // → ModelUsersIdGet
	 */
	exportModelsAs: OrString<"Models">;

	/**
	 * Controls how generated argument types are exported.
	 *
	 * Pass a plain string to use it as a namespace that wraps all argument typess.
	 * Pass a string containing `$` to export each argument types individually, with `$`
	 * replaced by the argument types' name.
	 *
	 * @default "Args"
	 *
	 * @example
	 * // Namespace mode (no `$`):
	 * exportArgsAs: "Args"
	 * // → Args.UsersGet
	 * // → Args.UsersIdGet
	 *
	 * @example
	 * // Template mode (with `$`):
	 * exportArgsAs: "Arg$"
	 * // → ArgUsersGet
	 * // → ArgUsersIdGet
	 */
	exportArgsAs: OrString<"Args">;

	/**
	 * Generated method names use endpoint paths by default,
	 * you can optionally ignore the global prefix.
	 */
	ignoreGlobalPrefix: boolean;

	/**
	 * Options forwarded to the appropriate JSON Schema conversion library for each route model.
	 *
	 * The correct shape depends on which validation library you are using:
	 *
	 * - **zod / arktype** — passed as the second argument to `schema["~standard"].jsonSchema.output()`.
	 * Accepts `StandardJSONSchemaV1.Options`:
	 * ```ts
	 * {
	 *   target?: "draft-07" | "draft-2020-12"; // default: "draft-07"
	 *   libraryOptions?: {
	 *     fallback?: (ctx: FallbackContext) => unknown; // handle unsupported types
	 *   };
	 * }
	 * ```
	 *
	 * - **yup** — passed as the second argument to `@sodaru/yup-to-json-schema` `convertSchema()`.
	 *
	 * @link https://github.com/sodaru/yup-to-json-schema
	 *
	 * @default
	 * ```ts
	 * {
	 *   target: "draft-07",
	 *   libraryOptions: {
	 *     fallback: (ctx) => ctx.base,
	 *   },
	 * }
	 * ```
	 *
	 * @example
	 * // arktype / zod — handle unsupported types gracefully
	 * { libraryOptions: { fallback: (ctx) => ctx.base } }
	 */
	jsonSchemaOptions: Record<string, unknown>;
};

export type PartialConfig = Partial<Config>;

export function defineConfig(config: PartialConfig): PartialConfig {
	return config;
}

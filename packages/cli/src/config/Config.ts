import type { Method } from "@ozanarslan/corpus";
import type { OrString } from "@ozanarslan/corpus/utils";

import type { ImportableKind } from "@/classes/Importable";

interface ApiClientConfig {
	/**
	 * Disables api client generation.
	 * Types and models are still generated.
	 *
	 * @default false
	 */
	disabled: boolean;
	/**
	 * Controls how the API Client is exported.
	 * Set to false if you don't want the api client.
	 *
	 * @default "CorpusApi"
	 */
	exportAs: OrString<"CorpusApi">;
	/**
	 * Makes all API Client methods and properties static.
	 *
	 * @default false
	 */
	useStaticClass: boolean;
}

export interface DefaultMethodsConfig {
	get: { propertyKey: OrString<"get">; address: `${Method} /${string}` };
	getByParams: { propertyKey: OrString<"getByParams">; address: `${Method} /${string}` };
	create: { propertyKey: OrString<"create">; address: `${Method} /${string}` };
	update: { propertyKey: OrString<"update">; address: `${Method} /${string}` };
	remove: { propertyKey: OrString<"remove">; address: `${Method} /${string}` };
}

export interface Config {
	/**
	 * Suppress console logs.
	 *
	 * @default false
	 */
	silent: boolean;

	/**
	 * The server entrypoint file path.
	 * This file should contain your instances and the listen call.
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
	 * The file path where the generated output will be written.
	 *
	 * @default "./src/corpus.gen.ts"
	 */
	output: string;

	/**
	 * Api Client specific configuration
	 */
	apiClient: ApiClientConfig;

	/**
	 * Collects all models to a namespace.
	 *
	 * @default true
	 */
	exportModelsNamespace: boolean;
	/**
	 * Collects all args to a namespace.
	 * Args are models without the response.
	 *
	 * @default true
	 */
	exportArgsNamespace: boolean;

	/**
	 * Generated method/type names ignore the global prefix by default,
	 * you can optionally include it.
	 *
	 * @default true
	 */
	ignoreGlobalPrefix: boolean;

	/**
	 * Default method names for the add modules.
	 * Used for model, service, and controllers.
	 * Map the default name to your custom one.
	 */
	defaultMethods: DefaultMethodsConfig;

	/**
	 * Custom output path templates per file kind, letting you control your own folder structure.
	 *
	 * Each template is a relative path string that supports the following placeholders:
	 * - `{resource}` — the resource name (e.g. `"user"`), cased per the `casing` option.
	 * - `{kind}` — the file kind (e.g. `"service"`, `"model"`, `"controller"`, `"route"`), cased per the `casing` option.
	 *
	 * Kinds without a matching entry fall back to the default template.
	 * The file extension is preserved as-is and not affected by casing.
	 *
	 * @default "{resource}/{resource}-{kind}.ts" (applied per kind when no override is set)*
	 *
	 *
	 * @example
	 * // group files by kind instead of by resource
	 * {
	 *   model: "models/{resource}-model.ts",
	 *   service: "services/{resource}-service.ts",
	 *   controller: "controllers/{resource}-controller.ts",
	 * }
	 */
	folderStructure: Partial<Record<ImportableKind, `${string}.ts`>>;
}

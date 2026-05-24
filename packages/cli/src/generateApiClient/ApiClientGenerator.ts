import fs from "node:fs";
import path from "path";

import type { EntityDefinition } from "@ozanarslan/corpus";
import type { UnknownObject } from "corpus-utils/UnknownObject";

import type { Config, PartialConfig } from "../config";
import { ConfigManager } from "../ConfigManager/ConfigManager";
import { SchemaManager } from "../SchemaManager/SchemaManager";
import { TypescriptWriter } from "../TypescriptWriter/TypescriptWriter";
import type { Schema } from "../utils/Schema";
import { toPascalCase } from "../utils/toPascalCase";

type DocEntry = { id: string; endpoint: string; method: string; model?: any };
type MapEntry = {
	camelKey: string;
	pascalKey: string;
	modelKey: string;
	argsKey: string;
	params: string[];
	model?: any;
	method: string;
	endpoint: string;
};

const bodyTypeGeneric = `BT extends "json" | "formData" = "json"`;

export class ApiClientGenerator {
	constructor(
		private readonly registry: any,
		private readonly cliOverrides: Omit<PartialConfig, "jsonSchemaOptions">,
	) {
		this.docs = this.registry.docs;
		this.entities = this.registry.entities.map;
	}

	private readonly docs: Map<string, DocEntry>;
	private readonly entities: Map<string, EntityDefinition>;
	private readonly schemaManager = new SchemaManager(this.config);

	get config(): Config {
		return {
			...ConfigManager.getDefaultConfig(),
			...ConfigManager.getFileConfig(),
			...this.cliOverrides,
		};
	}

	private get modelsNS() {
		return this.config.exportModelsAs;
	}
	private modelKey(pascalKey: string) {
		return this.modelsNS.includes("$")
			? this.modelsNS.replace("$", pascalKey)
			: `${this.modelsNS}.${pascalKey}`;
	}

	private get argsNS() {
		return this.config.exportArgsAs;
	}
	private argsKey(pascalKey: string) {
		return this.argsNS.includes("$")
			? this.argsNS.replace("$", pascalKey)
			: `${this.argsNS}.${pascalKey}`;
	}

	private get entitiesNS() {
		return this.config.exportEntitiesAs;
	}
	private entityKey(pascalKey: string) {
		return this.entitiesNS.includes("$")
			? this.entitiesNS.replace("$", pascalKey)
			: `${this.entitiesNS}.${pascalKey}`;
	}

	public async generate() {
		const outputPath = this.config.output.split("/");
		const dirName = outputPath.slice(0, -1);
		const fileName = outputPath[outputPath.length - 1] ?? "generated.ts";
		const dir = path.resolve(process.cwd(), ...dirName);
		const file = path.join(dir, fileName);
		fs.mkdirSync(dir, { recursive: true });

		const routes = Array.from(this.docs.values());
		const w = new TypescriptWriter(file);
		const map = this.getRouteMap(routes);

		this.writeInitialContent(w);

		if (this.entities.size > 0) {
			await this.writeEntities(w, this.entities);
		}
		await this.writeModelsNamespace(w, map);
		this.writeArgsNamespace(w, map);
		this.writeApiClientClass(w, map);
		this.writeExports(w);
		await w.format();
	}

	private getRouteMap(routes: DocEntry[]) {
		const map = new Map<string, MapEntry>();

		for (const r of routes) {
			const camelKey = this.toCamelCaseKey(r.endpoint, r.method);
			const pascalKey = this.capitalize(camelKey);

			map.set(r.id, {
				camelKey,
				pascalKey,
				params: this.extractParams(r.endpoint),
				modelKey: this.modelKey(pascalKey),
				argsKey: this.argsKey(pascalKey),
				model: r.model,
				method: r.method,
				endpoint: r.endpoint,
			});
		}

		return map;
	}

	private writeInitialContent(w: TypescriptWriter) {
		w.$type({ name: "_prim", value: "string | number | boolean" });
		w.line("");

		w.$type({ name: "_pretty", generics: ["T"], value: "{ [K in keyof T]: T[K] } & {}" });
		w.line("");

		w.$type({
			name: "_args",
			generics: ["T"],
			value: `Omit<T, "response"> & { headers?: HeadersInit; init?: RequestInit; }`,
		});
		w.line("");

		w.$interface({
			variant: "interface",
			name: "RequestDescriptor",
			body: (w) => {
				w.line("endpoint: string");
				w.line("method: string");
				w.line("body?: unknown");
				w.line("search?: UnkObj");
				w.line("headers?: HeadersInit");
				w.line(`init?: Omit<RequestInit, "headers">`);
			},
		});
		w.line("");

		w.$type({ name: "UnkObj", value: "Record<string, unknown>" });
		w.line("");
	}

	private async writeEntities(w: TypescriptWriter, map: Map<string, EntityDefinition>) {
		const types = new Map<string, string>();

		for (const def of map.values()) {
			if (def.jsonSchema) {
				types.set(def.name, await this.buildJsonSchemaType(def.jsonSchema as UnknownObject));
			} else {
				types.set(def.name, await this.buildSchemaType(def.schema));
			}
		}

		function write(w: TypescriptWriter, getKey?: (pascalKey: string) => string) {
			w.line(
				`const newable = <T>() => class { constructor(values: T) { Object.assign(this, values); } } as unknown as new (values: T) => T;`,
			);

			w.line("");

			const isExported = getKey == undefined;

			for (const [name, typedef] of types.entries()) {
				const pascalKey = toPascalCase(name);
				const key = getKey ? getKey(pascalKey) : pascalKey;
				w.$type({ isExported, name: key, value: typedef });
				w.$const({ isExported, name: key, value: `newable<${key}>()` });
			}
		}

		if (this.entitiesNS.includes("$")) {
			write(w, (pk) => this.entityKey(pk));
		} else {
			w.$namespace({ name: this.entitiesNS, body: (w) => write(w) });
		}
	}

	private async writeModelsNamespace(w: TypescriptWriter, map: Map<string, MapEntry>) {
		const models = new Map<
			string,
			Record<"body" | "search" | "params" | "response", string | null>
		>();

		for (const r of map.values()) {
			models.set(r.pascalKey, {
				body: r.model?.body ? await this.buildSchemaType(r.model.body) : null,
				search: r.model?.search ? await this.buildSchemaType(r.model.search) : "UnkObj",
				params: r.model?.params
					? await this.buildSchemaType(r.model.params)
					: r.params.length > 0
						? this.buildPrimitiveParamsType(r.params)
						: null,
				response: r.model?.response ? await this.buildSchemaType(r.model.response) : "void",
			});
		}

		function write(w: TypescriptWriter, getKey?: (pascalKey: string) => string) {
			const isExported = getKey == undefined;

			for (const [pascalKey, model] of models.entries()) {
				w.$type({
					isExported,
					name: getKey ? getKey(pascalKey) : pascalKey,
					generics: model.body ? [bodyTypeGeneric] : [],
					value: (w) => {
						w.inline(`_pretty<`);
						w.inline(`{ response: ${model.response} }`);
						if (model.params) w.inline(`& { params: ${model.params} }`);
						if (model.search) w.inline(`& { search?: ${model.search} }`);
						if (model.body)
							w.inline(`& { body: BT extends "formData" ? FormData : ${model.body} }`);
						w.inline(`>`);
					},
				});
			}
		}

		if (this.modelsNS.includes("$")) {
			write(w, (pk) => this.modelKey(pk));
		} else {
			w.$namespace({ name: this.modelsNS, body: (w) => write(w) });
		}
	}

	private writeArgsNamespace(w: TypescriptWriter, map: Map<string, MapEntry>) {
		function write(w: TypescriptWriter, getKey?: (pascalKey: string) => string) {
			const isExported = getKey == undefined;

			for (const r of map.values()) {
				w.$type({
					isExported,
					name: getKey ? getKey(r.pascalKey) : r.pascalKey,
					generics: r.model?.body ? [bodyTypeGeneric] : [],
					value: r.model?.body ? `_args<${r.modelKey}<BT>>` : `_args<${r.modelKey}>`,
				});
			}
		}

		if (this.argsNS.includes("$")) {
			write(w, (pk) => this.argsKey(pk));
		} else {
			w.$namespace({ name: this.argsNS, body: (w) => write(w) });
		}
	}

	private writeDefaultFetchFn(w: TypescriptWriter) {
		w.line(`const url = new URL(args.endpoint, this.baseUrl);`);
		w.line(`const headers = new Headers(args.headers);`);
		w.line(`const method: RequestInit["method"] = args.method;`);
		w.line(`let body: RequestInit["body"];`);

		w.$if(`args.search`).then((w) => {
			w.$for([`const`, `[key, val]`, `of`, `Object.entries(args.search)`], (w) => {
				w.$if(`val == null`).then((w) => w.line(`continue;`));
				w.line(
					`url.searchParams.append(key, ${w.tern(`typeof val === "object"`, `JSON.stringify(val)`, `String(val as _prim)`)});`,
				);
			});
		});

		w.$if(`args.body`).then((w) => {
			w.$if(`!headers.has("content-type")`, `&&`, `!(args.body instanceof FormData)`).then((w) => {
				w.line(`headers.set("content-type", "application/json");`);
			});
			w.$assign(
				"body",
				w.tern(`args.body instanceof FormData`, `args.body`, `JSON.stringify(args.body)`),
			);
		});

		w.$const({ name: "req", value: "new Request(url, { method, headers, body, ...args.init })" });
		w.$const({ name: "res", value: "await fetch(req)" });
		w.$const({ name: "contentType", value: `res.headers.get("content-type")` });
		w.$const({ name: "isJson", value: `contentType?.includes("application/json")` });
		w.$const({ name: "isText", value: `contentType?.includes("text/")` });
		w.$let({ name: `data`, type: `any` });
		w.$let({ name: `err`, type: `string` });

		w.$if(`isJson`)
			.then((w) => {
				w.$assign(`data`, `await res.json()`);
				w.$assign(`err`, `data.message ?? res.statusText`);
			})
			.elseif(`isText`)
			.then((w) => {
				w.$assign(`data`, `await res.text()`);
				w.$assign(`err`, w.tern(`data !== ""`, `data`, `res.statusText`));
			})
			.else((w) => {
				w.$assign(`data`, `await res.blob()`);
				w.$assign(`err`, `res.statusText`);
			});

		w.line(`if (!res.ok) throw new Error(err, { cause: data })`);
		w.$return(`data`);
	}

	private writeApiClientClass(w: TypescriptWriter, map: Map<string, MapEntry>) {
		w.$class({
			name: this.config.exportClientAs,
			constr: {
				args: [{ keyword: "public readonly", key: "baseUrl", type: "string" }],
			},
			body: (w) => {
				w.$arrowMethod({
					keyword: "public",
					isAsync: true,
					name: "fetchFn",
					type: "<R = unknown>(args: RequestDescriptor) => Promise<R>",
					args: ["args"],
					body: (w) => {
						this.writeDefaultFetchFn(w);
					},
				});

				w.$method({
					keyword: "public",
					isAsync: false,
					name: "setFetchFn",
					args: ["cb: <R = unknown>(args: RequestDescriptor) => Promise<R>"],
					body: (w) => w.$return("this.fetchFn = cb"),
				});

				w.$member({
					keyword: "public readonly",
					name: "endpoints",
					value: w.scope((w) => {
						for (const r of map.values()) {
							w.pair(
								r.camelKey,
								r.params.length === 0
									? w.str(r.endpoint)
									: `(p: ${r.argsKey}["params"]) => \`${r.endpoint
											.split(/:([a-zA-Z_][a-zA-Z0-9_]*)/)
											.map((part, i) => {
												if (i % 2 === 1) return `\${String(p.${part})}`;
												return part.replace("*", `\${String(p["*"])}`);
											})
											.join("")}\``,
							);
						}
					}),
				});
				w.line("");

				for (const r of map.values()) {
					w.$method({
						keyword: "public",
						name: r.camelKey,
						generics: r.model?.body ? [bodyTypeGeneric] : [],
						args: r.model?.body ? [`args: ${r.argsKey}<BT>`] : [`args: ${r.argsKey}`],
						body: (w) => {
							w.$const({
								name: "req",
								value: w.scope((w) => {
									if (r.params.length === 0) {
										w.pair("endpoint", w.str(r.endpoint));
									} else {
										w.pair(
											"endpoint",
											w.lit(
												r.endpoint
													.split(/:([a-zA-Z_][a-zA-Z0-9_]*)/)
													.map((part, i) => {
														if (i % 2 === 1) return `\${String(args.params.${part})}`;
														return part.replace("*", `\${String(args.params["*"])}`);
													})
													.join(""),
											),
										);
									}

									w.pair("method", w.str(r.method));
									w.pair("search", `args.search`);
									if (r.model?.body) {
										w.pair("body", `args.body`);
									}
								}),
							});
							w.$return(`this.fetchFn<${r.modelKey}["response"]>(req)`);
						},
					});
				}
			},
		});
	}

	private writeExports(w: TypescriptWriter) {
		const variables = Array.from(w.variables);
		const interfaces = Array.from(w.interfaces).filter(
			(t) => !["_prim", "_pretty", "_args", "UnkObj"].includes(t),
		);

		w.line("");
		w.$export({ variant: "type", keys: interfaces });
		w.line("");
		w.$export({ variant: "object", keys: variables });
	}

	private extractParams(path: string): string[] {
		const named = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)?.map((p) => p.substring(1)) ?? [];
		if (path.includes("*")) named.push("*");
		return named;
	}

	private buildPrimitiveParamsType(params: string[]) {
		return `{ ${params.map((p) => `${p === "*" ? '"*"' : p}: _prim`).join(";")}}`;
	}

	private capitalize(s: string): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	private toCamelCaseKey(endpoint: string, method: string): string {
		const globalPrefix = this.registry.prefix;
		let path = endpoint;
		if (this.config.ignoreGlobalPrefix && globalPrefix) {
			const prefixWithSlash = globalPrefix.startsWith("/") ? globalPrefix : `/${globalPrefix}`;
			if (path.startsWith(prefixWithSlash)) {
				path = path.slice(prefixWithSlash.length);
			}
		}

		const parts = path.split("/").filter((part) => part.length > 0);
		const processedParts = parts.map((part, index) => {
			let cleanPart = part.startsWith(":") ? part.substring(1) : part;

			// First handle hyphens: convert to camelCase
			cleanPart = cleanPart.replace(/-([a-zA-Z0-9])/g, (_, char) => {
				return char.toUpperCase();
			});

			// Then replace any other non-alphanumeric chars (except underscore) with underscore
			cleanPart = cleanPart.replace(/[^a-zA-Z0-9_]/g, "_");

			if (index === 0) return cleanPart;
			return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1);
		});
		let result = processedParts.join("");
		if (/^\d/.test(result)) result = "_" + result;

		return result + method.slice(0, 1).toUpperCase() + method.slice(1).toLowerCase();
	}

	private async buildJsonSchemaType(json: UnknownObject): Promise<string> {
		try {
			const inter = await this.schemaManager.toInterface(json);
			return inter;
		} catch (err) {
			console.error(
				`[corpus] Failed to convert json schema to TypeScript interface. ` +
					`Check your definition.\n` +
					`Schema: ${JSON.stringify(json, null, 2)}`,
			);
			throw err;
		}
	}
	private async buildSchemaType(schema: Schema): Promise<string> {
		try {
			const json = this.schemaManager.toJsonSchema(schema);
			const inter = await this.schemaManager.toInterface(json);
			return inter;
		} catch (err) {
			console.error(
				`[corpus] Failed to convert schema to TypeScript interface. ` +
					`Check your config.jsonSchemaOptions in corpus.config.ts.\n` +
					`Schema: ${JSON.stringify(schema, null, 2)}`,
			);
			throw err;
		}
	}
}

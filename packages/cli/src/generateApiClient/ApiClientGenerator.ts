import fs from "node:fs";
import path from "path";

import type { EntityDefinition } from "@ozanarslan/corpus";
import { log } from "corpus-utils/internalLog";
import type { UnknownObject } from "corpus-utils/UnknownObject";

import type { Config, PartialConfig } from "../config";
import { ConfigManager } from "../ConfigManager/ConfigManager";
import { Formatter } from "../Formatter/Formatter";
import { SchemaManager } from "../SchemaManager/SchemaManager";
import { StringBuilder } from "../StringBuilder/StringBuilder";
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
		const routes = Array.from(this.docs.values());

		const f = new Formatter();
		const b = new StringBuilder();

		const map = this.getRouteMap(routes);

		this.writeInitialContent(b);

		if (this.entities.size > 0) {
			await this.writeEntities(b, this.entities);
		}
		await this.writeModels(b, map);
		this.writeArgs(b, map);
		this.writeApiClientClass(b, map);

		const content = await f.format(b.read(), "typescript");
		const segments = this.config.output.split("/");
		const dirName = segments.slice(0, -1);
		const fileName = segments[segments.length - 1] ?? "corpus.gen.ts";
		const fpath = path.join(process.cwd(), ...dirName, fileName);
		fs.mkdirSync(path.dirname(fpath), { recursive: true });
		fs.writeFileSync(fpath, content);

		log.info(`Api Client written to: ${fpath}`);
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

	private writeInitialContent(b: StringBuilder) {
		b.line(`type _prim = string | number | boolean;`);
		b.line(``);
		b.line(`type _pretty<T> = { [K in keyof T]: T[K] } & {};`);
		b.line(``);
		b.line(`type _args<T> = Omit<T, "response"> & { headers?: HeadersInit; init?: RequestInit; };`);
		b.line(``);
		b.line(`type UnkObj = Record<string, unknown>;`);
		b.line(``);
		b.line(`interface RequestDescriptor {`);
		b.line(`    endpoint: string;`);
		b.line(`    method: string;`);
		b.line(`    body?: unknown;`);
		b.line(`    search?: UnkObj;`);
		b.line(`    headers?: HeadersInit;`);
		b.line(`    init?: Omit<RequestInit, "headers">;`);
		b.line(`}`);
	}

	private async writeEntities(b: StringBuilder, map: Map<string, EntityDefinition>) {
		const types = new Map<string, string>();

		for (const def of map.values()) {
			if (def.jsonSchema) {
				types.set(def.name, await this.buildJsonSchemaType(def.jsonSchema as UnknownObject));
			} else {
				types.set(def.name, await this.buildSchemaType(def.schema));
			}
		}

		b.line(`const newable = <T>() => class {`);
		b.line(`    constructor(values: T) { Object.assign(this, values); } `);
		b.line(`} as unknown as new (values: T) => T;`);
		b.line(``);

		const useTemplate = this.entitiesNS.includes("$");

		if (!useTemplate) b.line(`export namespace ${this.entitiesNS} {`);

		for (const [name, typedef] of types.entries()) {
			const pascalKey = toPascalCase(name);
			const key = useTemplate ? this.entityKey(pascalKey) : pascalKey;
			b.line(`export type ${key} = ${typedef};`);
			b.line(`export const ${key} = newable<${key}>();`);
			b.line(``);
		}

		if (!useTemplate) b.line(`}`);
	}

	private async writeModels(b: StringBuilder, map: Map<string, MapEntry>) {
		const models = new Map<
			string,
			Record<"body" | "search" | "params" | "response", string | null>
		>();

		for (const r of map.values()) {
			models.set(r.pascalKey, {
				body: r.model?.body ? await this.buildSchemaType(r.model?.body) : null,
				search: r.model?.search ? await this.buildSchemaType(r.model?.search) : "UnkObj",
				params: r.model?.params
					? await this.buildSchemaType(r.model?.params)
					: r.params.length > 0
						? this.buildPrimitiveParamsType(r.params)
						: null,
				response: r.model?.response ? await this.buildSchemaType(r.model?.response) : "void",
			});
		}

		const useTemplate = this.modelsNS.includes("$");

		if (!useTemplate) b.line(`export namespace ${this.modelsNS} {`);

		for (const [pascalKey, model] of models.entries()) {
			const key = useTemplate ? this.modelKey(pascalKey) : pascalKey;
			b.line(`export type ${key}${model.body ? `<${bodyTypeGeneric}>` : ``} = _pretty<`);
			b.line(`{ response: ${model.response} }`);
			if (model.params) b.line(`& { params: ${model.params} }`);
			if (model.search) b.line(`& { search?: ${model.search} }`);
			if (model.body) b.line(`& { body: BT extends "formData" ? FormData : ${model.body} }`);
			b.line(`>`);
		}

		if (!useTemplate) b.line(`}`);
	}

	private writeArgs(b: StringBuilder, map: Map<string, MapEntry>) {
		const useTemplate = this.argsNS.includes("$");

		if (!useTemplate) b.line(`export namespace ${this.argsNS} {`);

		for (const r of map.values()) {
			const key = useTemplate ? this.modelKey(r.pascalKey) : r.pascalKey;
			b.line(
				`export type ${key}${r.model?.body ? `<${bodyTypeGeneric}>` : ``} = _args<${r.modelKey}${r.model?.body ? `<BT>` : ``}>`,
			);
		}

		if (!useTemplate) b.line(`}`);
	}

	private writeApiClientClass(b: StringBuilder, map: Map<string, MapEntry>) {
		b.line(`export class ${this.config.exportClientAs} {`);
		b.line(`    constructor(public readonly baseUrl: string) {}`);
		b.line(``);
		b.line(
			`    public fetchFn: <R = unknown>(args: RequestDescriptor) => Promise<R> = async (args) => {`,
		);
		b.line(`	const url = new URL(args.endpoint, this.baseUrl);`);
		b.line(`	const headers = new Headers(args.headers);`);
		b.line(`	const method: RequestInit["method"] = args.method;`);
		b.line(`	let body: RequestInit["body"];`);
		b.line(`	if (args.search) {`);
		b.line(`	    for (const [key, val] of Object.entries(args.search)) {`);
		b.line(`	        if (val == null) continue;`);
		b.line(`	        url.searchParams.append(key, typeof val === "object"`);
		b.line(`	            ? JSON.stringify(val)`);
		b.line(`	            : String(val as _prim));`);
		b.line(`	    }`);
		b.line(`	}`);
		b.line(`	if (args.body) {`);
		b.line(`	    if (!headers.has("content-type") && !(args.body instanceof FormData)) {`);
		b.line(`	        headers.set("content-type", "application/json");`);
		b.line(`	    }`);
		b.line(`	    body = args.body instanceof FormData ? args.body : JSON.stringify(args.body);`);
		b.line(`	}`);
		b.line(`	const req = new Request(url, { method, headers, body, ...args.init });`);
		b.line(`	const res = await fetch(req);`);
		b.line(`	const contentType = res.headers.get("content-type");`);
		b.line(`	const isJson = contentType?.includes("application/json");`);
		b.line(`	const isText = contentType?.includes("text/");`);
		b.line(`	let data: any;`);
		b.line(`	let err: string;`);
		b.line(`	if (isJson) {`);
		b.line(`	    data = await res.json();`);
		b.line(`	    err = data.message ?? res.statusText;`);
		b.line(`	    `);
		b.line(`	    body = args.body instanceof FormData ? args.body : JSON.stringify(args.body);`);
		b.line(`	} else if (isText) {`);
		b.line(`	    data = await res.text();`);
		b.line(`	    err = data !== "" ? data : res.statusText;`);
		b.line(`	} else {`);
		b.line(`	    data = await res.blob();`);
		b.line(`	    err = res.statusText;`);
		b.line(`	}`);
		b.line(`	if (!res.ok) throw new Error(err, { cause: data })`);
		b.line(`	return data;`);
		b.line(`    }`);
		b.line(``);
		b.line(`    public setFetchFn(cb: <R = unknown>(args: RequestDescriptor) => Promise<R>) {`);
		b.line(`        this.fetchFn = cb;`);
		b.line(`    }`);
		b.line(``);
		b.line(`    public readonly endpoints = {`);
		for (const r of map.values()) {
			const key = r.camelKey;
			const val =
				r.params.length === 0
					? `"${r.endpoint}"`
					: `(p: ${r.argsKey}["params"]) => \`${r.endpoint
							.split(/:([a-zA-Z_][a-zA-Z0-9_]*)/)
							.map((part, i) => {
								if (i % 2 === 1) return `\${String(p.${part})}`;
								return part.replace("*", `\${String(p["*"])}`);
							})
							.join("")}\``;
			b.line(`        ${key}: ${val},`);
		}
		b.line(`    }`);
		b.line(``);
		for (const r of map.values()) {
			const endpointValue =
				r.params.length === 0
					? `"${r.endpoint}"`
					: `\`${r.endpoint
							.split(/:([a-zA-Z_][a-zA-Z0-9_]*)/)
							.map((part, i) => {
								if (i % 2 === 1) return `\${String(args.params.${part})}`;
								return part.replace("*", `\${String(args.params["*"])}`);
							})
							.join("")}\``;
			const fnKey = r.camelKey;
			const generic = r.model?.body ? `<${bodyTypeGeneric}>` : ``;
			const args = `args: ${r.argsKey}${r.model?.body ? `<BT>` : ``}`;
			b.line(`\tpublic ${fnKey}${generic}(${args}) {`);
			b.line(`\t\treturn this.fetchFn<${r.modelKey}["response"]>({`);
			b.line(`\t\t\tendpoint: ${endpointValue},`);
			b.line(`\t\t\tmethod: "${r.method}",`);
			b.line(`\t\t\tsearch: args.search,`);
			if (r.model?.body) b.line(`\t\t\tbody: args.body,`);
			b.line(`\t\t});`);
			b.line(`\t}`);
			b.line(``);
		}
		b.line(`}`);
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

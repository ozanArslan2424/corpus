import fs from "node:fs";
import path from "path";

import type { RouteBase } from "@ozanarslan/corpus";
import {
	type Maybe,
	cache,
	toPascalCase,
	isNil,
	isSomeArray,
	logger,
	StringBuilder,
	quote,
} from "@ozanarslan/corpus/utils";

import type { Config } from "@/config/Config";
import type { Schema } from "@/schema/Schema";
import { SchemaPrinter } from "@/schema/SchemaPrinter";

const MODEL_KEYS = ["body", "search", "params", "response"] as const;
const CT_GENERIC = `CT extends "json" | "formData" = "json"`;

const schemaPrinter = new SchemaPrinter();
const typeToNameMap = new Map<string, string>();

type Route = Omit<RouteBase, "register" | "handle" | "request"> & {
	camelKey: string;
	pascalKey: string;
	params: string[];
};

const toCamelCaseKey = cache(
	"toCamelCaseKey",
	(endpoint: string, method: string, globalPrefix: string, ignoreGlobalPrefix: boolean): string => {
		let path = endpoint;
		if (ignoreGlobalPrefix && globalPrefix) {
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
	},
);

const toPascalCaseKey = cache(
	"toPascalCaseKey",
	(endpoint: string, method: string, globalPrefix: string, ignoreGlobalPrefix: boolean): string => {
		const camel = toCamelCaseKey(endpoint, method, globalPrefix, ignoreGlobalPrefix);
		return camel.charAt(0).toUpperCase() + camel.slice(1);
	},
);

const extractParams = cache("extractParams", (endpoint: string): string[] => {
	const named = endpoint.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)?.map((p) => p.substring(1)) ?? [];
	if (endpoint.includes("*")) named.push("*");
	return named;
});

const getTypeName = cache("getTypeName", (pascal: string, ns?: string): string => {
	if (!ns) return pascal;
	return `${pascal}${toPascalCase(ns)}`;
});

const getTypeBody = cache(
	"getTypeBody",
	(endpoint: string, params: string[], modelKey: string, schema: Maybe<Schema>): string | null => {
		if (isNil(schema)) {
			if (modelKey === "params") {
				if (!isSomeArray(params)) return null;
				return `{ ${params.map((p) => `${p === "*" ? '"*"' : p}: primitive`).join("; ")} }`;
			}
			if (modelKey === "search") {
				return `UnknownRecord | undefined`;
			}
			if (modelKey === "response") {
				return `void`;
			}
			return null;
		}

		const res = schemaPrinter.print(schema, modelKey === "response" ? "out" : "in");
		if (res instanceof Error) {
			logger.error(`ERROR ${endpoint} ${modelKey}`, res);
			return null;
		}
		if (modelKey === "body") {
			return `CT extends "formData" ? FormData : ${res}`;
		}

		return res;
	},
);

const getTypeLine = cache(
	"getTypeLine",
	(modelKey: string, name: string, type: string, inner = false) => {
		const existing = typeToNameMap.get(type);
		const ib = new StringBuilder();
		if (!existing) typeToNameMap.set(type, name);
		if (!inner) ib.line(`export type ${name}`);
		if (modelKey === "body" && !inner) ib.inline(`<${CT_GENERIC}>`);
		const optional = type.endsWith(`| undefined`) ? `?` : ``;
		ib.inline(inner ? `${modelKey}${optional}: ` : ` = `);
		ib.inline(existing ?? type);
		if (existing && modelKey === "body") ib.inline(`<CT>`);
		return ib.toString();
	},
);

export function generateApiClient(prefix: string, routesArr: Array<RouteBase>, config: Config) {
	const b = new StringBuilder();

	const routes = routesArr.map((route) => {
		const camelKey = toCamelCaseKey(
			route.endpoint,
			route.method,
			prefix,
			config.ignoreGlobalPrefix,
		);
		const pascalKey = toPascalCaseKey(
			route.endpoint,
			route.method,
			prefix,
			config.ignoreGlobalPrefix,
		);
		const params = extractParams(route.endpoint);
		return { ...route, id: route.id, camelKey, pascalKey, params };
	}) satisfies Array<Route>;

	writeBase(b, routes);

	for (const route of routes) {
		writeRouteTypes(b, route);
	}

	for (const route of routes) {
		writeRouteModel(b, route);
	}

	b.line(``);
	b.line(`export const endpoints = {`);
	for (const route of routes) {
		writeEndpoint(b, route);
	}
	b.line(`};`);

	if (!config.apiClient.disabled) {
		b.line(``);
		b.line(`export class ${config.apiClient.exportAs} {`);
		writeApiClientBoilerplate(b, config.apiClient.useStaticClass);
		for (const route of routes) {
			writeApiClientMethod(b, route, config.apiClient.useStaticClass);
		}
		b.line(`}`);
	}

	const content = b.toString();
	const segments = config.output.split("/");
	const dirName = segments.slice(0, -1);
	const fileName = segments[segments.length - 1] ?? "corpus.gen.ts";
	const fpath = path.join(process.cwd(), ...dirName, fileName);
	fs.mkdirSync(path.dirname(fpath), { recursive: true });
	fs.writeFileSync(fpath, content);

	logger.info(`Api Client written to: ${fpath}`);
}

function writeBase(b: StringBuilder, routes: Array<Route>) {
	const wildcardExists = routes.some((r) => r.endpoint.includes("*"));

	b.line(`// #region base`);
	b.line(`type UnknownRecord = Record<string, unknown>;`);
	typeToNameMap.set(`Record<string, unknown>`, `UnknownRecord`);

	b.line(`type primitive = string | number | boolean;`);
	typeToNameMap.set(`string | number | boolean`, `primitive`);

	if (wildcardExists) {
		b.line(`type wildcard = { "*": primitive };`);
		typeToNameMap.set(`{ "*": primitive }`, `wildcard`);
	}

	// b.line(`type pretty<T> = { [K in keyof T]: T[K] } & {};`);
	b.line(`type args<T> = Omit<T, "response"> & { init?: RequestInit; };`);

	b.line(``);
	b.line(`export interface RequestDescriptor {`);
	b.line(1)(`endpoint: string;`);
	b.line(1)(`method: string;`);
	b.line(1)(`body?: unknown;`);
	b.line(1)(`search?: UnknownRecord;`);
	b.line(1)(`init?: RequestInit;`);
	b.line(`}`);
	b.line(`// #endregion`);
	b.line(``);
}

function writeRouteTypes(b: StringBuilder, route: Route) {
	b.line(``);
	b.line(`// #region ${route.id} types`);
	for (const modelKey of MODEL_KEYS) {
		const schema = route.model?.[modelKey];
		const name = getTypeName(route.pascalKey, modelKey);
		const type = getTypeBody(route.endpoint, route.params, modelKey, schema);
		if (!type) continue;
		b.line(getTypeLine(modelKey, name, type));
	}
	b.line(`// #endregion`);
}

function writeRouteModel(b: StringBuilder, route: Route) {
	b.line(``);
	b.line(`// #region ${route.id} model`);
	b.line(`export interface ${getTypeName(route.pascalKey, "Model")}`);
	if (!isNil(route.model?.body)) b.inline(`<${CT_GENERIC}>`);
	b.inline(` {`);
	for (const modelKey of MODEL_KEYS) {
		const schema = route.model?.[modelKey];
		const name = getTypeName(route.pascalKey, modelKey);
		const type = getTypeBody(route.endpoint, route.params, modelKey, schema);
		if (!type) continue;
		b.line(1)(getTypeLine(modelKey, name, type, true));
	}
	b.line(`}`);
	b.line(`// #endregion`);
}

function writeEndpoint(b: StringBuilder, route: Route) {
	const modelInterfaceKey = getTypeName(route.pascalKey, "Model");
	const endpoint = isSomeArray(route.params)
		? `(p: ${modelInterfaceKey}["params"]) => \`${route.endpoint
				.split(/:([a-zA-Z_][a-zA-Z0-9_]*)/)
				.map((part, i) =>
					i % 2 === 1 ? `\${String(p.${part})}` : part.replace("*", `\${String(p["*"])}`),
				)
				.join("")}\``
		: `"${route.endpoint}"`;
	b.line(1)(`${route.camelKey}: ${endpoint},`);
}

function writeApiClientBoilerplate(b: StringBuilder, useStaticClass: boolean) {
	const pfx = useStaticClass ? "static" : "public";

	b.line(1)(`constructor(public readonly baseUrl: string) {}`);
	b.line(``);
	b.line(1)(`${pfx} fetchFn: <R>(args: RequestDescriptor) => Promise<R> = async (args) => {`);
	b.line(2)(`const url = new URL(args.endpoint, this.baseUrl);`);
	b.line(2)(`const headers = new Headers(args.init?.headers);`);
	b.line(2)(`const method: RequestInit["method"] = args.method;`);
	b.line(2)(`let body: RequestInit["body"];`);
	b.line(2)(`if (args.search) {`);
	b.line(3)(`for (const [key, val] of Object.entries(args.search)) {`);
	b.line(4)(`if (val == null) continue;`);
	b.line(4)(`url.searchParams.append(key, typeof val === "object"`);
	b.line(5)(`? JSON.stringify(val)`);
	b.line(5)(`: String(val as primitive));`);
	b.line(3)(`}`);
	b.line(2)(`}`);
	b.line(2)(`if (args.body) {`);
	b.line(3)(`if (!headers.has("content-type") && !(args.body instanceof FormData)) {`);
	b.line(4)(`headers.set("content-type", "application/json");`);
	b.line(3)(`}`);
	b.line(3)(`body = args.body instanceof FormData ? args.body : JSON.stringify(args.body);`);
	b.line(2)(`}`);
	b.line(2)(`const req = new Request(url, { method, headers, body, ...args.init });`);
	b.line(2)(`const res = await fetch(req);`);
	b.line(2)(`const contentType = res.headers.get("content-type");`);
	b.line(2)(`const isJson = contentType?.includes("application/json");`);
	b.line(2)(`const isText = contentType?.includes("text/");`);
	b.line(2)(`let data: any;`);
	b.line(2)(`let err: string;`);
	b.line(2)(`if (isJson) {`);
	b.line(3)(`data = await res.json();`);
	b.line(3)(`err = data.message ?? res.statusText;`);
	b.line(3)(`body = args.body instanceof FormData ? args.body : JSON.stringify(args.body);`);
	b.line(2)(`} else if (isText) {`);
	b.line(3)(`data = await res.text();`);
	b.line(3)(`err = data !== "" ? data : res.statusText;`);
	b.line(2)(`} else {`);
	b.line(3)(`data = await res.blob();`);
	b.line(3)(`err = res.statusText;`);
	b.line(2)(`}`);
	b.line(2)(`if (!res.ok) throw new Error(err, { cause: data })`);
	b.line(2)(`return data;`);
	b.line(1)(`}`);
	b.line(``);
	b.line(1)(`${pfx} setFetchFn(cb: <R>(args: RequestDescriptor) => Promise<R>): void {`);
	b.line(2)(`this.fetchFn = cb;`);
	b.line(1)(`}`);
	b.line(``);
	b.line(1)(`${pfx} readonly endpoints = endpoints;`);
	b.line(``);
}

function writeApiClientMethod(b: StringBuilder, route: Route, useStaticClass: boolean) {
	const pfx = useStaticClass ? "static" : "public";

	const endpoint = `this.endpoints.${route.camelKey}${isSomeArray(route.params) ? `(args.params)` : ``}`;
	const generic = !isNil(route.model?.body) ? `<${CT_GENERIC}>` : ``;
	const args = `args: args<${getTypeName(route.pascalKey, "Model")}${!isNil(route.model?.body) ? `<CT>` : ``}>`;

	b.line(``);
	b.line(1)(`/** ${route.id} */`);
	b.line(1)(`${pfx} ${route.camelKey}${generic}(${args}) {`);
	b.line(2)(`return this.fetchFn<${getTypeName(route.pascalKey, "response")}>({`);
	b.line(3)(`endpoint: ${endpoint},`);
	b.line(3)(`method: ${quote(route.method)},`);
	b.line(3)(`...args,`);
	b.line(2)(`});`);
	b.line(1)(`}`);
}

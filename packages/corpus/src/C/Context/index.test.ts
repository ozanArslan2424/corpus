import { beforeEach, describe, expect, it } from "bun:test";

import { createSafeObject } from "@ozanarslan/utils";
import { type } from "arktype";

import { $registry, C } from "#corpus";

import { TEST_HOST, TEST_PORT } from "../../../test/utils/req";

const method = "POST";
const endpoint = "/hello/:world";
const body = "body";

const params = {
	world: "test",
};
const search = {
	searchParam: true,
};

function applyParams(endpoint: string, params: Record<string, string>): string {
	for (const [key, val] of Object.entries(params)) {
		endpoint = endpoint.replace(`:${key}`, val);
	}
	return endpoint;
}

function toCookieHeader(plainCookies: Record<string, string>): string {
	let result = "";
	for (const [key, val] of Object.entries(plainCookies)) {
		result += `${key}=${val};`;
	}
	return result;
}

const url = new URL(`http://${TEST_HOST}:${TEST_PORT}${applyParams(endpoint, params)}`);
for (const [key, val] of Object.entries(search)) {
	url.searchParams.set(key, String(val));
}

const plainCookies = {
	with: "chocolate-chips",
};

const cookies = new Bun.CookieMap(plainCookies);

const plainHeaders = {
	[C.HeaderKey.Authorization]: "Bearer user",
	[C.HeaderKey.Cookie]: toCookieHeader(plainCookies),
};

const headers = new Headers(plainHeaders);

const request = new Request(url, { method, body, headers });

const server = new C.Server({ hostname: TEST_HOST, port: TEST_PORT });

// stable context ref to avoid actual request handling
let context = new C.Context(request, server.app);

const model = {
	body: type("string"),
	response: type("string"),
	search: type({ "searchParam?": "boolean" }),
	params: type({ world: "string" }),
};

beforeEach(() => {
	// refresh context to avoid stale ref
	context = new C.Context(request, server.app);
});

async function applyParsing(route: C.Route) {
	const rawBody = await $registry.bodyParser.parse(request);
	const parsedBody = await $registry.schemaParser.parse("body", rawBody, route.model?.body);
	const rawParams = $registry.urlParamsParser.parse(params);
	const parsedParams = await $registry.schemaParser.parse("params", rawParams, route.model?.params);
	const rawSearch = $registry.searchParamsParser.parse(url.searchParams);
	const parsedSearch = await $registry.schemaParser.parse("search", rawSearch, route.model?.search);

	return {
		rawBody,
		parsedBody,
		rawParams,
		parsedParams,
		rawSearch,
		parsedSearch,
	};
}

describe("Context", () => {
	describe("members - initial", () => {
		it("rawBody", () => {
			expect(context.rawBody).toBeUndefined();
		});
		it("body", () => {
			expect(context.body).toEqual(createSafeObject());
		});
		it("params", () => {
			expect(context.params).toEqual(createSafeObject());
		});
		it("search", () => {
			expect(context.search).toEqual(createSafeObject());
		});
		it("data", () => {
			expect(context.data).toEqual(createSafeObject());
		});
	});

	// context is mutated during handle
	describe("members - after handle - no model", async () => {
		const route = new C.Route<unknown, unknown, unknown, unknown>(
			{ method, path: endpoint },
			() => "ok",
		);

		const { rawBody, parsedBody, rawParams, parsedParams, rawSearch, parsedSearch } =
			await applyParsing(route);

		it("rawBody", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.rawBody as unknown).toEqual(rawBody);
			expect(rawBody).toEqual(parsedBody as any);
		});

		it("body", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.body).toEqual(parsedBody);
			expect(rawBody).toEqual(parsedBody as any);
		});

		it("params", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.params).toEqual(parsedParams);
			expect(rawParams).toEqual(parsedParams as any);
		});

		it("search", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.search).toEqual(parsedSearch);
			expect(rawSearch).toEqual(parsedSearch as any);
		});
	});

	describe("members - after handle - with model", async () => {
		const route = new C.Route<unknown, unknown, unknown, unknown>(
			{ method, path: endpoint },
			() => "ok",
			model,
		);

		const { parsedBody, parsedParams, parsedSearch } = await applyParsing(route);

		it("body", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.body).toEqual(parsedBody);
		});

		it("params", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.params).toEqual(parsedParams);
		});

		it("search", async () => {
			await server.handleRoute(context, route, params, (c) => route.handler(c));
			expect(context.search).toEqual(parsedSearch);
		});
	});

	describe("lazy members - initial", () => {
		it("_res", () => {
			// @ts-expect-error
			expect(context._res).toBeNull();
		});

		it("get res", () => {
			expect(context.res).toBeInstanceOf(C.Res);
		});

		it("set res", () => {
			expect(context.res.status).toBe(C.Status.OK);
			context.res = new C.Res("", { status: C.Status.INTERNAL_SERVER_ERROR });
			expect(context.res.body).toBe("");
			expect(context.res.status).toBe(C.Status.INTERNAL_SERVER_ERROR);
		});

		it("_url", () => {
			// @ts-expect-error
			expect(context._url).toBeNull();
		});

		it("get url", () => {
			expect(context.url).toBeInstanceOf(URL);
		});

		it("set url - url is readonly", () => {
			expect(context.url).toEqual(url);
			const newUrl = new URL("https://www.example.com");
			expect(() => {
				// @ts-expect-error
				context.url = newUrl;
			}).toThrow(TypeError);
			expect(context.url).toEqual(url);
		});

		it("_cookies", () => {
			// @ts-expect-error
			expect(context._cookies).toBeNull();
		});

		it("get cookies", () => {
			expect(context.cookies).toBeInstanceOf(Bun.CookieMap);
			for (const [key, val] of Object.entries(plainCookies)) {
				expect(context.cookies.get(key)).toBe(val);
			}
		});

		it("set cookies - cookies is readonly", () => {
			expect(context.cookies).toEqual(cookies);
			const newCookies = new Bun.CookieMap({ something: "new" });
			expect(() => {
				// @ts-expect-error
				context.cookies = newCookies;
			}).toThrow(TypeError);
			expect(context.cookies).toEqual(cookies);
		});
	});

	describe("inferred members - initial", () => {
		it("headers are from request", () => {
			expect(context.headers).toEqual(request.headers);
			expect(context.req.headers).toEqual(request.headers);
			expect(context.headers).toEqual(context.req.headers);
		});

		it("get headers", () => {
			expect(context.headers).toBeInstanceOf(Headers);
			for (const [key, val] of Object.entries(plainHeaders)) {
				expect(context.headers.get(key)).toBe(val);
			}
		});

		it("set headers - headers is readonly", () => {
			expect(context.headers).toEqual(headers);
			const newHeaders = new Headers({ something: "new" });
			expect(() => {
				// @ts-expect-error
				context.headers = newHeaders;
			}).toThrow(TypeError);
			expect(context.headers).toEqual(headers);
		});
	});
});

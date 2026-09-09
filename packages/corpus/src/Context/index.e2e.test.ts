import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { type } from "arktype";
import { z } from "zod";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Middleware } from "@/Middleware";
import { Res } from "@/Res";
import { Route } from "@/RouteBase/Route";
import { isNil } from "@/utils/maybe";

declare module "@/index" {
	interface ContextDataInterface {
		requestId?: string;
		touchedBy?: Array<string>;
	}
}

const PORT = 48181;
const BASE_URL = `http://localhost:${PORT}`;

const JSON_HEADERS = { "content-type": "application/json" };

let app: App;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	// ---------------------------------------------------------------- no model

	new Route("GET /ctx/url", (c) => ({
		pathname: c.url.pathname,
		search: c.url.search,
		q: c.url.searchParams.get("q"),
		host: c.url.host,
		memoized: c.url === c.url,
	}));

	new Route("POST /ctx/req", (c) => ({
		method: c.req.method,
		custom: c.req.headers.get("x-custom"),
		isRequest: c.req instanceof Request,
		hasServer: !isNil(c.server),
	}));

	new Route("GET /ctx/defaults", (c) => ({
		bodyKeys: Object.keys(c.body as object),
		searchKeys: Object.keys(c.search as object),
		dataKeys: Object.keys(c.data),
		dataNullProto: Object.getPrototypeOf(c.data) === null,
	}));

	new Route("GET /ctx/no-model/:id", (c) => ({
		params: { ...(c.params as object) },
		search: { ...(c.search as object) },
		types: {
			id: typeof (c.params as Record<string, unknown>).id,
			tag: typeof (c.search as Record<string, unknown>).tag,
		},
	}));

	// ------------------------------------------------------------ zod model

	const zodBody = z.object({ name: z.string().min(1), age: z.coerce.number() });
	const zodSearch = z.object({ page: z.coerce.number().int() });
	const zodParams = z.object({ id: z.coerce.number().int() });

	new Route(
		"POST /zod/users/:id",
		(c) => ({
			body: { ...c.body },
			search: { ...c.search },
			params: { ...c.params },
			types: {
				age: typeof c.body.age,
				page: typeof c.search.page,
				id: typeof c.params.id,
			},
		}),
		{ body: zodBody, search: zodSearch, params: zodParams },
	);

	// -------------------------------------------------------- arktype model

	const arkBody = type({ name: "string", qty: "number" });
	const arkSearch = type({ "q?": "string" });
	const arkParams = type({ id: type("string | number").pipe((raw) => Number(raw)) });

	new Route(
		"POST /ark/items/:id",
		(c) => ({
			body: { ...c.body },
			search: { ...c.search },
			params: { ...c.params },
			searchKeys: Object.keys(c.search),
			idType: typeof c.params.id,
		}),
		{ body: arkBody, search: arkSearch, params: arkParams },
	);

	// --------------------------------------------------------- data handoff

	const dataRoute = new Route("GET /ctx/data", (c) => ({
		requestId: c.data.requestId,
		touchedBy: c.data.touchedBy,
	}));

	new Middleware({
		useOn: dataRoute,
		handler: (c, next) => {
			c.data.requestId = "req-1";
			c.data.touchedBy = [...(c.data.touchedBy ?? []), "middleware"];
			return next();
		},
	});

	// ----------------------------------------------------------------- res

	new Route("GET /ctx/res-headers", (c) => {
		c.res.headers.setMany({ "X-From-Context": "yes" });
		return { memoized: c.res === c.res };
	});

	new Route("GET /ctx/res-replaced", (c) => {
		c.res.headers.setMany({ "X-Original": "yes" });
		const replacement = new Res();
		replacement.headers.setMany({ "X-Replaced": "yes" });
		c.res = replacement;
		return "ok";
	});

	await app.listen();
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Context e2e", () => {
	describe("request surface", () => {
		it("exposes the parsed request URL and memoizes it", async () => {
			const res = await fetch(`${BASE_URL}/ctx/url?q=hello&n=1`);
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.pathname).toBe("/ctx/url");
			expect(body.search).toBe("?q=hello&n=1");
			expect(body.q).toBe("hello");
			expect(body.host).toBe(`localhost:${PORT}`);
			expect(body.memoized).toBe(true);
		});

		it("exposes the real Request and the bound Server", async () => {
			const res = await fetch(`${BASE_URL}/ctx/req`, {
				method: "POST",
				headers: { ...JSON_HEADERS, "x-custom": "sent" },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.method).toBe("POST");
			expect(body.custom).toBe("sent");
			expect(body.isRequest).toBe(true);
			expect(body.hasServer).toBe(true);
		});

		it("starts body, search and data as empty null-prototype objects", async () => {
			const res = await fetch(`${BASE_URL}/ctx/defaults`);
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.bodyKeys).toEqual([]);
			expect(body.searchKeys).toEqual([]);
			expect(body.dataKeys).toEqual([]);
			expect(body.dataNullProto).toBe(true);
		});
	});

	describe("without a model", () => {
		it("populates params and search without coercing them", async () => {
			const res = await fetch(`${BASE_URL}/ctx/no-model/u_42?q=hello&tag=beta`);
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.params).toEqual({ id: "u_42" });
			expect(body.search).toEqual({ q: "hello", tag: "beta" });
			expect(body.types).toEqual({ id: "string", tag: "string" });
		});
	});

	describe("with a zod model", () => {
		it("assigns the validated and transformed values onto the context", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/42?page=2`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", age: "26" }),
			});
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.body).toEqual({ name: "Ozan", age: 26 });
			expect(body.search).toEqual({ page: 2 });
			expect(body.params).toEqual({ id: 42 });
			expect(body.types).toEqual({ age: "number", page: "number", id: "number" });
		});

		it("rejects an invalid body with 422", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/42?page=2`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: 123, age: 26 }),
			});
			expect(res.status).toBe(422);
		});

		it("rejects invalid params with 422", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/abc?page=2`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", age: 26 }),
			});
			expect(res.status).toBe(422);
		});

		it("rejects an invalid search with 422", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/42?page=later`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", age: 26 }),
			});
			expect(res.status).toBe(422);
		});
	});

	describe("with an arktype model", () => {
		it("assigns the validated value and applies morphs onto the context", async () => {
			const res = await fetch(`${BASE_URL}/ark/items/7`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "widget", qty: 3 }),
			});
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.body).toEqual({ name: "widget", qty: 3 });
			expect(body.params).toEqual({ id: 7 });
			expect(body.idType).toBe("number");
			expect(body.searchKeys).toEqual([]);
		});

		it("carries an optional search key through when it is provided", async () => {
			const res = await fetch(`${BASE_URL}/ark/items/7?q=widgets`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "widget", qty: 3 }),
			});
			expect(res.status).toBe(200);
			expect((await res.json()).search).toEqual({ q: "widgets" });
		});

		it("rejects an invalid body with 422", async () => {
			const res = await fetch(`${BASE_URL}/ark/items/7`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "widget", qty: "3" }),
			});
			expect(res.status).toBe(422);
		});
	});

	describe("data", () => {
		it("carries middleware-assigned data through to the handler", async () => {
			const res = await fetch(`${BASE_URL}/ctx/data`);
			expect(res.status).toBe(200);

			const body = await res.json();
			expect(body.requestId).toBe("req-1");
			expect(body.touchedBy).toEqual(["middleware"]);
		});

		it("does not leak data between requests", async () => {
			await fetch(`${BASE_URL}/ctx/data`);
			const res = await fetch(`${BASE_URL}/ctx/data`);
			expect((await res.json()).touchedBy).toEqual(["middleware"]);
		});
	});

	describe("res", () => {
		it("sends headers set on the lazily-created res, which is memoized", async () => {
			const res = await fetch(`${BASE_URL}/ctx/res-headers`);
			expect(res.status).toBe(200);
			expect(res.headers.get("X-From-Context")).toBe("yes");
			expect((await res.json()).memoized).toBe(true);
		});

		it("honors a res replaced through the setter", async () => {
			const res = await fetch(`${BASE_URL}/ctx/res-replaced`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("ok");
			expect(res.headers.get("X-Replaced")).toBe("yes");
			expect(res.headers.get("X-Original")).toBeNull();
		});
	});
});

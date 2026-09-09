import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Method } from "@/Request";
import { Res, Status } from "@/Res";
import { Route } from "@/RouteBase/Route";

const PORT = 48191;
const BASE_URL = `http://localhost:${PORT}`;

const JSON_HEADERS = { "content-type": "application/json" };

let app: App;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	// ------------------------------------------------------------- addresses

	new Route("GET /string-address", () => "string address");
	new Route({ method: Method.GET, endpoint: "/object-address" }, () => "object address");

	// --------------------------------------------------------------- methods

	new Route("GET /resource", () => ({ method: "GET" }));
	new Route("POST /resource", () => ({ method: "POST" }));
	new Route("PUT /resource", () => ({ method: "PUT" }));
	new Route("DELETE /resource", () => ({ method: "DELETE" }));
	new Route("PATCH /resource", () => ({ method: "PATCH" }));

	// ---------------------------------------------------------------- params

	new Route("GET /users/:id", (c) => ({ params: { ...(c.params as object) } }));
	new Route("GET /users/:id/posts/:postId", (c) => ({ params: { ...(c.params as object) } }));

	// ---------------------------------------------------------------- search

	new Route("GET /search", (c) => ({ search: { ...(c.search as object) } }));

	// ------------------------------------------------------------------ body

	new Route("POST /echo", (c) => ({ body: c.body }));

	// -------------------------------------------------------- return values

	new Route("GET /returns/object", () => ({ ok: true, nested: { n: 1 } }));
	new Route("GET /returns/string", () => "plain text");
	new Route("GET /returns/res", () => new Res({ custom: true }, { status: Status.CREATED }));
	new Route("GET /returns/async", async () => {
		await Bun.sleep(5);
		return { async: true };
	});

	// ---------------------------------------------------------------- errors

	new Route("GET /throws/exception", () => {
		throw new Exception("teapot", Status.IM_A_TEAPOT);
	});
	new Route("GET /throws/async", async () => {
		await Bun.sleep(5);
		throw new Exception("late teapot", Status.IM_A_TEAPOT);
	});
	new Route("GET /throws/error", () => {
		throw new Error("unexpected");
	});

	await app.listen();
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Route e2e", () => {
	describe("addresses", () => {
		it("serves a route registered with a string address", async () => {
			const res = await fetch(`${BASE_URL}/string-address`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("string address");
		});

		it("serves a route registered with an object address", async () => {
			const res = await fetch(`${BASE_URL}/object-address`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("object address");
		});

		it("404s an unregistered endpoint", async () => {
			const res = await fetch(`${BASE_URL}/nothing-here`);
			expect(res.status).toBe(404);
		});
	});

	describe("methods", () => {
		it("dispatches each method to its own handler on a shared endpoint", async () => {
			for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
				const res = await fetch(`${BASE_URL}/resource`, { method });
				expect(res.status).toBe(200);
				expect(await res.json()).toEqual({ method });
			}
		});

		it("does not serve an endpoint on an unregistered method", async () => {
			const res = await fetch(`${BASE_URL}/string-address`, { method: "POST" });
			expect(res.status).toBe(404);
		});
	});

	describe("params", () => {
		it("parses a single path param", async () => {
			const res = await fetch(`${BASE_URL}/users/42`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ params: { id: 42 } });
		});

		it("parses multiple path params", async () => {
			const res = await fetch(`${BASE_URL}/users/42/posts/7`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ params: { id: 42, postId: 7 } });
		});

		it("decodes percent-encoded param values", async () => {
			const res = await fetch(`${BASE_URL}/users/${encodeURIComponent("a b/c")}`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ params: { id: "a b/c" } });
		});
	});

	describe("search", () => {
		it("parses the query string onto the context", async () => {
			const res = await fetch(`${BASE_URL}/search?q=hello&page=2`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ search: { q: "hello", page: 2 } });
		});

		it("yields an empty search when the query string is absent", async () => {
			const res = await fetch(`${BASE_URL}/search`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ search: {} });
		});
	});

	describe("body", () => {
		it("parses a JSON body onto the context", async () => {
			const res = await fetch(`${BASE_URL}/echo`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", tags: ["a", "b"] }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: { name: "Ozan", tags: ["a", "b"] } });
		});

		it("parses a urlencoded body onto the context", async () => {
			const res = await fetch(`${BASE_URL}/echo`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ name: "Ozan" }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: { name: "Ozan" } });
		});

		it("treats an empty body as empty, even when a content-type is declared", async () => {
			const res = await fetch(`${BASE_URL}/echo`, { headers: JSON_HEADERS, method: "POST" });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: {} });
		});
	});

	describe("return values", () => {
		it("serializes an object return value as JSON", async () => {
			const res = await fetch(`${BASE_URL}/returns/object`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toContain("application/json");
			expect(await res.json()).toEqual({ ok: true, nested: { n: 1 } });
		});

		it("sends a string return value as-is", async () => {
			const res = await fetch(`${BASE_URL}/returns/string`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("plain text");
		});

		it("uses a returned Res, including its status", async () => {
			const res = await fetch(`${BASE_URL}/returns/res`);
			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ custom: true });
		});

		it("awaits an async handler", async () => {
			const res = await fetch(`${BASE_URL}/returns/async`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ async: true });
		});
	});

	describe("errors", () => {
		it("turns a synchronously thrown Exception into its response", async () => {
			const res = await fetch(`${BASE_URL}/throws/exception`);
			expect(res.status).toBe(418);
			expect(await res.json()).toMatchObject({ message: "teapot" });
		});

		it("turns an asynchronously thrown Exception into its response", async () => {
			const res = await fetch(`${BASE_URL}/throws/async`);
			expect(res.status).toBe(418);
			expect(await res.json()).toMatchObject({ message: "late teapot" });
		});

		it("turns an unexpected Error into a 500", async () => {
			const res = await fetch(`${BASE_URL}/throws/error`);
			expect(res.status).toBe(500);
		});
	});
});

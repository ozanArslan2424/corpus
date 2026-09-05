import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import type { ContextHandler } from "@/Context";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { Method } from "@/Request";
import { resolveRouteAddress, RouteBase, RouteVariant, type RouteConfig } from "@/RouteBase";

afterEach(() => {
	Globals.delete("apps");
});

// RouteBase is abstract - a minimal concrete subclass is needed to exercise
// id/register/handle/request, which live on the base class itself.
class TestRoute extends RouteBase<any, any, any, unknown, string> {
	readonly variant: RouteVariant = RouteVariant.dynamic;
	method: Method;
	endpoint: string;
	config?: RouteConfig;
	handler: ContextHandler;

	constructor(method: Method, endpoint: string, handler: ContextHandler = () => "ok") {
		super();
		this.method = method;
		this.endpoint = endpoint;
		this.handler = handler;
	}
}

describe("resolveRouteAddress", () => {
	it("defaults to GET for a plain string with no method prefix", () => {
		expect(resolveRouteAddress("/users")).toEqual({ method: Method.GET, endpoint: "/users" });
	});

	it("resolves a 'METHOD endpoint' string address", () => {
		expect(resolveRouteAddress("POST /users")).toEqual({ method: Method.POST, endpoint: "/users" });
	});

	it("uppercases a lowercase method prefix", () => {
		expect(resolveRouteAddress("post /users")).toEqual({ method: Method.POST, endpoint: "/users" });
	});

	it("returns an object address unchanged", () => {
		const address = { method: Method.PUT, endpoint: "/x" };
		expect(resolveRouteAddress(address)).toBe(address);
	});

	it("throws when the method prefix is not a valid HTTP verb", () => {
		expect(() => resolveRouteAddress("FOO /users")).toThrow();
	});

	it("throws when the endpoint is empty after the method prefix", () => {
		expect(() => resolveRouteAddress("GET ")).toThrow();
	});

	it("treats a path with no space as the whole endpoint regardless of content", () => {
		expect(resolveRouteAddress("GET")).toEqual({ method: Method.GET, endpoint: "GET" });
	});
});

describe("RouteBase", () => {
	describe("id", () => {
		it("combines the uppercased method and endpoint", () => {
			const route = new TestRoute(Method.GET, "/users");
			expect(route.id).toBe("GET /users");
		});

		it("uppercases a lowercase method value", () => {
			const route = new TestRoute("get" as Method, "/users");
			expect(route.id).toBe("GET /users");
		});
	});

	describe("register", () => {
		it("pushes itself onto the nearest App's routes array", () => {
			Globals.set("apps", []);
			const app = new App();
			const route = new TestRoute(Method.GET, "/users");

			route.register();

			expect(app.routes).toContain(route);
		});

		it("throws when there is no active App", () => {
			Globals.set("apps", []);
			const route = new TestRoute(Method.GET, "/users");
			expect(() => route.register()).toThrow();
		});
	});

	describe("request", () => {
		beforeEach(() => {
			Globals.set("apps", []);
			new App();
		});

		it("builds a Request with the correct method and joined endpoint", () => {
			const route = new TestRoute(Method.GET, "/users");
			const req = route.request({});
			expect(req.method).toBe(Method.GET);
			expect(new URL(req.url).pathname).toBe("/users");
		});

		it("substitutes :param placeholders in the endpoint from data.params", () => {
			const route = new TestRoute(Method.GET, "/users/:id");
			const req = route.request({ params: { id: "42" } });
			expect(new URL(req.url).pathname).toBe("/users/42");
		});

		it("appends data.search as query string parameters", () => {
			const route = new TestRoute(Method.GET, "/users");
			const req = route.request({ search: { q: "ozan", page: 2 } });
			const url = new URL(req.url);
			expect(url.searchParams.get("q")).toBe("ozan");
			expect(url.searchParams.get("page")).toBe("2");
		});

		it("applies custom headers from data.headers", () => {
			const route = new TestRoute(Method.GET, "/users");
			const req = route.request({ headers: { "X-Custom": "value" } });
			expect(req.headers.get("X-Custom")).toBe("value");
		});

		it("JSON-stringifies a plain object body and sets application/json", async () => {
			const route = new TestRoute(Method.POST, "/users");
			const req = route.request({ body: { name: "Ozan" } });
			expect(req.headers.get(HeaderKey.ContentType)).toBe("application/json");
			expect(await req.text()).toBe(JSON.stringify({ name: "Ozan" }));
		});

		it("leaves body undefined when none is provided", async () => {
			const route = new TestRoute(Method.GET, "/users");
			const req = route.request({});
			expect(await req.text()).toBe("");
		});
	});

	describe("handle", () => {
		beforeEach(() => {
			Globals.set("apps", []);
			new App();
		});

		it("invokes the handler and returns its result", async () => {
			const route = new TestRoute(Method.GET, "/users", () => "handled");
			const result = await route.handle({});
			expect(result).toBe("handled");
		});

		it("assigns data.body onto context.body before invoking the handler when it's an object", async () => {
			let receivedBody: unknown;
			const route = new TestRoute(Method.POST, "/users", (c) => {
				receivedBody = c.body;
				return "ok";
			});
			await route.handle({ body: { name: "Ozan" } });
			expect(receivedBody).toEqual({ name: "Ozan" });
		});

		it("assigns data.params onto context.params before invoking the handler when it's an object", async () => {
			let receivedParams: unknown;
			const route = new TestRoute(Method.GET, "/users/:id", (c) => {
				receivedParams = c.params;
				return "ok";
			});
			await route.handle({ params: { id: "42" } });
			expect(receivedParams).toEqual({ id: "42" });
		});

		it("assigns data.search onto context.search before invoking the handler when it's an object", async () => {
			let receivedSearch: unknown;
			const route = new TestRoute(Method.GET, "/users", (c) => {
				receivedSearch = c.search;
				return "ok";
			});
			await route.handle({ search: { q: "ozan" } });
			expect(receivedSearch).toEqual({ q: "ozan" });
		});

		it("does not assign body/params/search onto context when they are not objects", async () => {
			let receivedBody: unknown;
			const route = new TestRoute(Method.POST, "/users", (c) => {
				receivedBody = c.body;
				return "ok";
			});
			// context.body defaults to {} per Context - it should remain that default
			await route.handle({});
			expect(receivedBody).toEqual({});
		});
	});
});

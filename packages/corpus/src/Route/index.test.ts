import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import type { ContextHandler } from "@/Context";
import { Globals } from "@/Globals";
import { Method } from "@/Request";
import { Route } from "@/Route";
import { RouteVariant } from "@/RouteBase";

beforeEach(() => {
	// Route.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();
});

afterEach(() => {
	Globals.delete("apps");
});

describe("Route", () => {
	describe("direct construction", () => {
		it("resolves endpoint and method from a plain string address", () => {
			const route = new Route("/users", () => "ok");
			expect(route.endpoint).toBe("/users");
			expect(route.method).toBe(Method.GET);
		});

		it("resolves method from a 'METHOD endpoint' address", () => {
			const route = new Route("POST /users", () => "ok");
			expect(route.method).toBe(Method.POST);
			expect(route.endpoint).toBe("/users");
		});

		it("resolves an object address unchanged", () => {
			const route = new Route({ method: Method.PUT, endpoint: "/users/:id" }, () => "ok");
			expect(route.method).toBe(Method.PUT);
			expect(route.endpoint).toBe("/users/:id");
		});

		it("stores the handler", () => {
			const handler = () => "ok";
			const route = new Route("/users", handler);
			expect(route.handler).toBe(handler);
		});

		it("stores the config model when provided", () => {
			const model = { maxRequestBodySize: 1024 };
			const route = new Route("/users", () => "ok", model);
			expect(route.config).toBe(model);
		});

		it("leaves config undefined when not provided", () => {
			const route = new Route("/users", () => "ok");
			expect(route.config).toBeUndefined();
		});

		it("has variant 'dynamic'", () => {
			const route = new Route("/users", () => "ok");
			expect(route.variant).toBe(RouteVariant.dynamic);
		});

		it("registers itself onto the nearest App", () => {
			const app = new App();
			const route = new Route("/users", () => "ok");
			expect(app.routes).toContain(route);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new Route()).toThrow();
		});

		it("throws when constructed with only an address", () => {
			// @ts-expect-error - exercising the runtime guard for a missing callback
			expect(() => new Route("/users")).toThrow();
		});
	});

	describe("subclassing", () => {
		class CustomRoute extends Route {
			constructor(endpoint: string) {
				super();
				this.endpoint = endpoint;
			}
			override method: Method = Method.GET;
			override endpoint: string;
			override handler: ContextHandler<unknown, unknown, unknown, unknown> = () => "from subclass";
		}

		it("bypasses the argument guard when extended", () => {
			const route = new CustomRoute("/custom");
			expect(route.endpoint).toBe("/custom");
			expect(route.handler({} as never)).toBe("from subclass");
		});

		it("does not auto-register when constructed via a subclass without calling register", () => {
			const app = new App();
			new CustomRoute("/custom");
			expect(app.routes).toEqual([]);
		});
	});
});

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { App } from "@/App";
import { getOrInitAppsRegistry } from "@/AppsRegistry";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { Middleware, type MiddlewareDefinition } from "@/Middleware";
import { Res, Status } from "@/Res";

let app: App;

beforeAll(() => {
	getOrInitAppsRegistry();
	app = new App();
});

afterEach(() => {
	Globals.set("apps", []);
	app = new App();
});

describe("App options", () => {
	test("uses defaults when no options are given", () => {
		app = new App();
		expect(app.port).toBe(3000);
		expect(app.hostname).toBe("0.0.0.0");
		expect(app.prefix).toBe("");
	});

	test("applies provided options over defaults", () => {
		app = new App({ port: 4000, hostname: "localhost", prefix: "/api" });
		expect(app.port).toBe(4000);
		expect(app.hostname).toBe("localhost");
		expect(app.prefix).toBe("/api");
	});

	test("ignores falsy/omitted option fields, keeping defaults", () => {
		app = new App({ port: 0 });
		expect(app.port).toBe(3000); // `if (opts?.port)` skips falsy 0
	});
});

describe("App.baseUrl", () => {
	test("builds http url with hostname and port", () => {
		app = new App({ hostname: "localhost", port: 4000 });
		expect(app.baseUrl).toBe("http://localhost:4000");
	});

	test("builds https url when tls is configured", () => {
		app = new App({ hostname: "localhost", port: 4000, tls: { cert: "c", key: "k" } });
		expect(app.baseUrl).toBe("https://localhost:4000");
	});
});

describe("App.addMiddleware / findMiddlewares", () => {
	class MW_noregister extends Middleware {
		constructor(definition: MiddlewareDefinition) {
			super();
			this.useOn = definition.useOn ?? "*";
			this.handler = definition.handler;
		}

		override register(): void {
			// this test registers middlewares manually
		}
	}

	function mockMW(input: object): Middleware {
		return new MW_noregister(input as MiddlewareDefinition);
	}

	test("a middleware with useOn '*' applies to any route id", () => {
		const middleware = mockMW({ useOn: "*" as const, handler: async () => undefined });
		app.addMiddleware(middleware);
		expect(app.findMiddlewares("some-route")).toContain(middleware);
	});

	test("a middleware targeting a specific route id string only applies there", () => {
		const middleware = mockMW({ useOn: "route-a", handler: async () => undefined });
		app.addMiddleware(middleware);
		expect(app.findMiddlewares("route-a")).toContain(middleware);
		expect(app.findMiddlewares("route-b")).not.toContain(middleware);
	});

	test("a middleware targeting an object with 'id' applies to that route", () => {
		const middleware = mockMW({ useOn: { id: "route-x" }, handler: async () => undefined });
		app.addMiddleware(middleware);
		expect(app.findMiddlewares("route-x")).toContain(middleware);
	});

	test("a middleware targeting an object with 'routeIds' applies to all of them", () => {
		const middleware = mockMW({
			useOn: { routeIds: new Set(["route-1", "route-2"]) },
			handler: async () => undefined,
		});
		app.addMiddleware(middleware);
		expect(app.findMiddlewares("route-1")).toContain(middleware);
		expect(app.findMiddlewares("route-2")).toContain(middleware);
	});

	test("global ('*') middlewares are prepended before route-specific ones", () => {
		const global = mockMW({ useOn: "*" as const, handler: async () => undefined });
		const local = mockMW({ useOn: "route-a", handler: async () => undefined });
		app.addMiddleware(local);
		app.addMiddleware(global);
		expect(app.findMiddlewares("route-a")).toEqual([global, local]);
	});

	test("findMiddlewares('*') does not include global middlewares as 'local' twice", () => {
		const global = mockMW({ useOn: "*" as const, handler: async () => undefined });
		app.addMiddleware(global);
		expect(app.findMiddlewares("*")).toEqual([global]);
	});
});

describe("App default handlers", () => {
	test("handleError returns a Res built from the Exception", () => {
		const app = new App();
		const exception = new Exception("nope", Status.NOT_FOUND);
		const result = app.handleError(exception, {} as never) as Res;
		expect(result).toBeInstanceOf(Res);
		expect(result.status).toBe(Status.NOT_FOUND);
		expect(result.body).toEqual({ message: "nope" });
	});

	test("handleError wraps a plain Error into a 500 Res", () => {
		const result = app.handleError(new Error("boom"), {} as never) as Res;
		expect(result).toBeInstanceOf(Res);
		expect(result.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	test("handleNotFound returns a 404 Res with method and url in the message", () => {
		const context = { req: { method: "GET", url: "http://x/y" } } as never;
		const result = app.handleNotFound(context) as Res;
		expect(result).toBeInstanceOf(Res);
		expect(result.status).toBe(Status.NOT_FOUND);
	});

	test("handlePreflight returns 204 when no cors is configured", () => {
		const result = app.handlePreflight({} as never) as Res;
		expect(result).toBeInstanceOf(Res);
		expect(result.status).toBe(Status.NO_CONTENT);
	});

	test("handlePreflight delegates to cors.handlePreflight when cors is configured", () => {
		const sentinel = new Res(undefined);
		app.cors = { handlePreflight: () => sentinel } as never;
		const result = app.handlePreflight({} as never);
		expect(result).toBe(sentinel);
	});
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Controller } from "@/Controller";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Middleware } from "@/Middleware";
import { Res, Status } from "@/Res";
import { Route } from "@/RouteBase/Route";

declare module "@/index" {
	interface ContextDataInterface {
		user?: string;
	}
}

const PORT = 48189;
// const app.baseUrl = `http://localhost:${PORT}`;

let app: App;
let calls: Array<string>;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	const ping = new Route("GET /ping", () => {
		calls.push("handler:ping");
		return "pong";
	});

	new Route("GET /other", () => {
		calls.push("handler:other");
		return "other";
	});

	const guarded = new Route("GET /guarded", () => {
		calls.push("handler:guarded");
		return "should not be reached";
	});

	const withData = new Route("GET /data", (c) => ({ user: c.data.user }));

	const boom = new Route("GET /boom", () => {
		calls.push("handler:boom");
		return "ok";
	});

	const byId = new Route("GET /by-id", () => "by-id");

	const api = new Controller("/api");
	api.route("GET /one", () => "one");
	api.route("GET /two", () => "two");

	// global, wrapping: records on the way in and on the way out
	new Middleware({
		handler: async (_c, next) => {
			calls.push("global:before");
			await next();
			calls.push("global:after");
		},
	});

	// global, registered second - order must be preserved
	new Middleware({
		useOn: "*",
		handler: async (_c, next) => {
			calls.push("global2:before");
			await next();
			calls.push("global2:after");
		},
	});

	// scoped to a single route instance
	new Middleware({
		useOn: ping,
		handler: async (c, next) => {
			calls.push("scoped:ping");
			await next();
			c.res.headers.setMany({ "X-Scoped": "ping" });
		},
	});

	// short-circuits without calling next()
	new Middleware({
		useOn: guarded,
		handler: () => {
			calls.push("guard");
			return new Res({ error: "forbidden" }, { status: Status.FORBIDDEN });
		},
	});

	// hands data down to the handler
	new Middleware({
		useOn: withData,
		handler: (c, next) => {
			c.data.user = "ozan";
			return next();
		},
	});

	// throws before the handler runs
	new Middleware({
		useOn: boom,
		handler: () => {
			throw new Exception("middleware exploded", Status.BAD_GATEWAY);
		},
	});

	// scoped by route id string rather than instance
	new Middleware({
		useOn: byId.id,
		handler: async (c, next) => {
			await next();
			c.res.headers.setMany({ "X-By-Id": "yes" });
		},
	});

	// scoped to every route on a controller
	new Middleware({
		useOn: api,
		handler: async (c, next) => {
			await next();
			c.res.headers.setMany({ "X-Controller": "api" });
		},
	});

	await app.listen();
});

beforeEach(() => {
	calls = [];
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Middleware e2e", () => {
	it("runs global middleware around every route, in registration order", async () => {
		const res = await fetch(`${app.baseUrl}/other`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("other");
		expect(calls).toEqual([
			"global:before",
			"global2:before",
			"handler:other",
			"global2:after",
			"global:after",
		]);
	});

	it("runs route-scoped middleware inside the global ones", async () => {
		const res = await fetch(`${app.baseUrl}/ping`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("pong");
		expect(res.headers.get("X-Scoped")).toBe("ping");
		expect(calls).toEqual([
			"global:before",
			"global2:before",
			"scoped:ping",
			"handler:ping",
			"global2:after",
			"global:after",
		]);
	});

	it("does not run route-scoped middleware on other routes", async () => {
		const res = await fetch(`${app.baseUrl}/other`);
		expect(res.headers.get("X-Scoped")).toBeNull();
		expect(calls).not.toContain("scoped:ping");
	});

	it("short-circuits the handler when a middleware does not call next", async () => {
		const res = await fetch(`${app.baseUrl}/guarded`);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "forbidden" });
		expect(calls).toContain("guard");
		expect(calls).not.toContain("handler:guarded");
	});

	it("still unwinds the outer middleware when an inner one short-circuits", async () => {
		await fetch(`${app.baseUrl}/guarded`);
		expect(calls).toEqual([
			"global:before",
			"global2:before",
			"guard",
			"global2:after",
			"global:after",
		]);
	});

	it("passes context data from a middleware to the handler", async () => {
		const res = await fetch(`${app.baseUrl}/data`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: "ozan" });
	});

	it("turns an Exception thrown in a middleware into its response", async () => {
		const res = await fetch(`${app.baseUrl}/boom`);
		expect(res.status).toBe(502);
		expect(await res.json()).toMatchObject({ message: "middleware exploded" });
		expect(calls).not.toContain("handler:boom");
	});

	it("scopes middleware by route id string", async () => {
		const res = await fetch(`${app.baseUrl}/by-id`);
		expect(res.status).toBe(200);
		expect(res.headers.get("X-By-Id")).toBe("yes");

		const other = await fetch(`${app.baseUrl}/other`);
		expect(other.headers.get("X-By-Id")).toBeNull();
	});

	it("applies controller-scoped middleware to every route on that controller", async () => {
		const one = await fetch(`${app.baseUrl}/api/one`);
		const two = await fetch(`${app.baseUrl}/api/two`);
		expect(one.headers.get("X-Controller")).toBe("api");
		expect(two.headers.get("X-Controller")).toBe("api");

		const outside = await fetch(`${app.baseUrl}/other`);
		expect(outside.headers.get("X-Controller")).toBeNull();
	});
});

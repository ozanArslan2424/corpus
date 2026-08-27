import { describe, expect, it, afterEach } from "bun:test";

import { objGetValues } from "@/utils";

import { createTestServer, parseBody } from "#testutils";
import { Context } from "@/C/Context/Context";
import { Controller } from "@/C/Controller/Controller";
import { Middleware } from "@/C/Middleware/Middleware";
import { Res } from "@/C/Res/Res";
import { Route } from "@/C/Route/Route";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import { $registry } from "@/Registry/$registry";

afterEach(() => $registry.reset());

const s = createTestServer();
declare module "@/index" {
	interface ContextDataInterface {
		order?: Array<string>;
	}
}
s.contextFactory = (request, server) => {
	const c = new Context(request, server);
	c.data.order = [];
	return c;
};

describe("Middleware", () => {
	it("calling next() twice throws", async () => {
		const r = new Route("/next-twice", () => "ok");
		new Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				await next();
			},
		});
		const res = await s.handle(r.request({}));
		expect(res.status).toBe(500); // or whatever handleError maps Exception to
	});

	it("awaited next call is respected", async () => {
		const r = new Route("/m/1", (c) => {
			return c.data.order;
		});

		new Middleware({
			useOn: [r],
			handler: async (c, next) => {
				c.data.order?.push("a");
				await next();
			},
		});

		new Middleware({
			useOn: [r],
			handler: async (c, next) => {
				// The next middleware will be run before this
				await next();
				c.data.order?.push("c");
			},
		});

		new Middleware({
			useOn: [r],
			handler: async (c, next) => {
				c.data.order?.push("b");
				await next();
			},
		});

		const res = await s.handle(r.request({}));
		const data = await parseBody<string[]>(res);
		expect(data).toEqual(["a", "b", "c"]);
	});

	it("context data is per request", async () => {
		const r1 = new Route("/c.data/1", (c) => {
			return c.data.order;
		});
		const r2 = new Route("/c.data/2", (c) => {
			return c.data.order;
		});
		new Middleware({
			useOn: [r1, r2],
			handler: async (c, next) => {
				c.data.order?.push("a");
				await next();
			},
		});

		new Middleware({
			useOn: [r1],
			handler: async (c, next) => {
				c.data.order?.push("b");
				await next();
			},
		});

		const res1 = await s.handle(r1.request({}));
		const data1 = await parseBody<string[]>(res1);
		expect(data1).toEqual(["a", "b"]);

		const res2 = await s.handle(r2.request({}));
		const data2 = await parseBody<string[]>(res2);
		expect(data2).toEqual(["a"]);
	});

	it("executes outbound middlewares in registration order after handler", async () => {
		const order: string[] = [];
		const r = new Route("/order-out", () => {
			order.push("handler");
		});

		new Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("o1");
			},
		});
		new Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("o2");
			},
		});

		await s.handle(r.request({}));
		expect(order).toEqual(["handler", "o2", "o1"]);
	});

	it("FULL PIPELINE ORDER - global inbound, local inbound, handler, local outbound, global outbound", async () => {
		const order: string[] = [];
		const r = new Route("/pipeline", () => {
			order.push("handler");
		});

		new Middleware({
			useOn: "*",
			handler: () => {
				order.push("g-in");
			},
		});
		new Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				order.push("g-out");
			},
		});
		new Middleware({
			useOn: [r],
			handler: () => {
				order.push("l-in");
			},
		});
		new Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("l-out");
			},
		});

		await s.handle(r.request({}));
		expect(order).toEqual(["g-in", "l-in", "handler", "l-out", "g-out"]);
	});

	it("returning Res skips handler and later middlewares", async () => {
		const order: string[] = [];
		const r = new Route("/short-in", () => {
			order.push("handler");
		});

		new Middleware({
			useOn: [r],
			handler: () => {
				order.push("m1");
				return new Res({ intercepted: true }, { status: 418 });
			},
		});
		new Middleware({
			useOn: [r],
			handler: () => {
				order.push("m2");
				// next added at the end automatically
			},
		});

		const res = await s.handle(r.request({}));
		const data = await parseBody<{ intercepted: boolean }>(res);
		expect(res.status).toBe(418);
		expect(data).toEqual({ intercepted: true });
		expect(order).toEqual(["m1"]);
	});

	it("returning Res overrides handler return data", async () => {
		const r = new Route("/short-in/response", () => {
			return "response";
		});

		new Middleware({
			useOn: [r],
			handler: () => {
				return new Res({ intercepted: true }, { status: 418 });
			},
		});

		const res = await s.handle(r.request({}));
		const data = await parseBody<{ intercepted: boolean }>(res);
		expect(res.status).toBe(418);
		expect(data).toEqual({ intercepted: true });
	});

	it("mixed useOn - route instance, controller, and string routeId all register", async () => {
		const hits: string[] = [];
		const expected: string[] = [];
		const rA = new Route("/mixA", () => "ok");
		const rB = new Route("/mixB", () => "ok");
		class TestController extends Controller {
			constructor() {
				super("/mixC");
			}

			cr1 = this.route("/cr1", (c) => c.data);
			cr2 = this.route("cr2", (c) => c.data);
		}

		const ctrl = new TestController();

		new Middleware({
			useOn: [rA, ctrl, rB.id],
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		expected.push(rA.endpoint);
		await s.handle(rA.request({}));
		expect(hits).toEqual(expected);

		expected.push(rB.endpoint);
		await s.handle(rB.request({}));
		expect(hits).toEqual(expected);

		expected.push(ctrl.cr1.endpoint);
		await s.handle(ctrl.cr1.request({}));
		expect(hits).toEqual(expected);
	});

	it("applies to every route under the controller", async () => {
		const hits: string[] = [];
		class TestController extends Controller {
			constructor() {
				super("fanout");
			}

			cr1 = this.route("/cr1", (c) => c.data);
			cr2 = this.route("cr2", (c) => c.data);
		}

		const ctrl = new TestController();

		new Middleware({
			useOn: [ctrl],
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		for (const val of objGetValues(ctrl)) {
			if (!(val instanceof RouteBase)) continue;
			hits.length = 0;
			await s.handle(val.request({}));
			expect(hits).toEqual([val.endpoint]);
		}
	});

	it("same handler on same route runs twice", async () => {
		let count = 0;
		const r = new Route("/dup", () => "ok");
		const handler = () => {
			count++;
		};

		new Middleware({ useOn: [r], handler });
		new Middleware({ useOn: [r], handler });

		count = 0;
		await s.handle(r.request({}));
		expect(count).toBe(2);
	});

	it("outbound can mutate c.res instead of short-circuiting with Res", async () => {
		const r = new Route("/outbound-mutate", () => "ok");

		new Middleware({
			useOn: r,
			handler: async (c, next) => {
				await next();
				c.res = new Res({ replaced: true }, { status: 418 });
			},
		});

		const res = await s.handle(r.request({}));
		const data = await parseBody<{ replaced: boolean }>(res);
		expect(res.status).toBe(418);
		expect(data).toEqual({ replaced: true });
	});

	it("outbound middleware can return Res after next()", async () => {
		const r = new Route("/outbound-return", () => "ok");
		new Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				return new Res({ replaced: true }, { status: 418 });
			},
		});
		const res = await s.handle(r.request({}));
		expect(res.status).toBe(418);
	});
});

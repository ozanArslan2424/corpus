import { describe, expect, it, beforeEach } from "bun:test";

import { $registryTesting, TC, type MiddlewareHandler } from "../_modules";
import { createTestController } from "../utils/createTestController";
import { createTestServer } from "../utils/createTestServer";
import { parseBody } from "../utils/parse";
import { req } from "../utils/req";

beforeEach(() => {
	$registryTesting.reset();
});

const s = createTestServer();

const pathnameFromId = (id: string) => id.split(" ")[1]!;

describe("C.Middleware - find() correctness & matching", () => {
	it("EXECUTES INBOUND MIDDLEWARES IN REGISTRATION ORDER", async () => {
		const order: string[] = [];
		const r = new TC.Route("/order-in", (c) => {
			c.data = order.slice();
			return c.data;
		});

		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				order.push("a");
				await next();
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				order.push("b");
				await next();
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				order.push("c");
				await next();
			},
		});

		const res = await s.handle(req("/order-in"));
		const data = await parseBody<string[]>(res);
		expect(data).toEqual(["a", "b", "c"]);
	});

	it("EXECUTES OUTBOUND MIDDLEWARES IN REGISTRATION ORDER AFTER HANDLER", async () => {
		const order: string[] = [];
		const r = new TC.Route("/order-out", (c) => {
			order.push("handler");
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("o1");
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("o2");
			},
		});

		await s.handle(req("/order-out"));
		expect(order).toEqual(["handler", "o2", "o1"]);
	});

	it("FULL PIPELINE ORDER - global inbound, local inbound, handler, local outbound, global outbound", async () => {
		const order: string[] = [];
		const r = new TC.Route("/pipeline", (c) => {
			order.push("handler");
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: "*",
			handler: () => {
				order.push("g-in");
			},
		});
		new TC.Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				order.push("g-out");
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: () => {
				order.push("l-in");
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("l-out");
			},
		});

		await s.handle(req("/pipeline"));
		expect(order).toEqual(["g-in", "l-in", "handler", "l-out", "g-out"]);
	});

	it("INBOUND SHORT-CIRCUIT - returning Res skips handler and later middlewares", async () => {
		const order: string[] = [];
		const r = new TC.Route("/short-in", (c) => {
			order.push("handler");
			c.data = "should-not-run";
		});

		new TC.Middleware({
			useOn: [r],
			handler: () => {
				order.push("m1");
				return new TC.Res({ intercepted: true }, { status: 418 });
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: () => {
				order.push("m2");
			},
		});

		const res = await s.handle(req("/short-in"));
		const data = await parseBody<{ intercepted: boolean }>(res);
		expect(res.status).toBe(418);
		expect(data).toEqual({ intercepted: true });
		expect(order).toEqual(["m1"]);
	});

	it("GLOBAL INBOUND SHORT-CIRCUIT - skips routing entirely", async () => {
		const order: string[] = [];
		const r = new TC.Route("/short-global", (c) => {
			order.push("handler");
			c.data = "ok";
		});
		new TC.Middleware({
			useOn: [r],
			handler: () => {
				order.push("local");
			},
		});
		new TC.Middleware({
			useOn: "*",
			handler: () => {
				order.push("global");
				return new TC.Res({ gate: "closed" }, { status: 401 });
			},
		});

		const res = await s.handle(req("/short-global"));
		expect(res.status).toBe(401);
		expect(order).toEqual(["global"]);
	});

	it("MIXED useOn - route instance, controller, and string routeId all register", async () => {
		const hits: string[] = [];
		const rA = new TC.Route("/mixA", (c) => {
			c.data = hits.slice();
		});
		const rB = new TC.Route("/mixB", (c) => {
			c.data = hits.slice();
		});
		const ctrl = createTestController("mix-ctrl");

		new TC.Middleware({
			useOn: [rA, ctrl, rB.id],
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		hits.length = 0;
		await s.handle(req("/mixA"));
		expect(hits).toEqual(["/mixA"]);

		hits.length = 0;
		await s.handle(req("/mixB"));
		expect(hits).toEqual(["/mixB"]);

		hits.length = 0;
		await s.handle(req("/mix-ctrl/cr1"));
		expect(hits).toEqual(["/mix-ctrl/cr1"]);
	});

	it("CONTROLLER FAN-OUT - middleware applies to every route under the controller", async () => {
		const hits: string[] = [];
		const ctrl = createTestController("fanout");

		new TC.Middleware({
			useOn: [ctrl],
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		for (const id of ctrl.routeIds) {
			hits.length = 0;
			await s.handle(req(pathnameFromId(id)));
			expect(hits).toEqual([pathnameFromId(id)]);
		}
	});

	it("ISOLATION - middleware on route A does not run on route B", async () => {
		const hits: string[] = [];
		const rA = new TC.Route("/isoA", (c) => {
			c.data = "a";
		});
		new TC.Route("/isoB", (c) => {
			c.data = "b";
		});

		new TC.Middleware({
			useOn: [rA],
			handler: () => {
				hits.push("A-mw");
			},
		});

		await s.handle(req("/isoB"));
		expect(hits).toEqual([]);

		await s.handle(req("/isoA"));
		expect(hits).toEqual(["A-mw"]);
	});

	it("DUPLICATE REGISTRATION - same handler on same route runs twice", async () => {
		let count = 0;
		const r = new TC.Route("/dup", (c) => {
			c.data = count;
		});
		const handler: MiddlewareHandler = () => {
			count++;
		};

		new TC.Middleware({ useOn: [r], handler });
		new TC.Middleware({ useOn: [r], handler });

		count = 0;
		await s.handle(req("/dup"));
		expect(count).toBe(2);
	});

	it("INBOUND vs OUTBOUND SEPARATION - variants do not cross-contaminate", async () => {
		const order: string[] = [];
		const r = new TC.Route("/variants", (c) => {
			order.push("handler");
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				order.push("inbound");
				await next();
			},
		});
		new TC.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("outbound");
			},
		});

		await s.handle(req("/variants"));
		expect(order).toEqual(["inbound", "handler", "outbound"]);
	});

	it("CONTROLLER + SPECIFIC ROUTE - route receives both middlewares in registration order", async () => {
		const order: string[] = [];
		const ctrl = createTestController("layered");
		const firstRouteId = Array.from(ctrl.routeIds.values())[0]!;

		new TC.Middleware({
			useOn: [ctrl],
			handler: () => {
				order.push("ctrl");
			},
		});
		new TC.Middleware({
			useOn: [firstRouteId],
			handler: () => {
				order.push("route");
			},
		});

		await s.handle(req(pathnameFromId(firstRouteId)));
		expect(order).toEqual(["ctrl", "route"]);
	});

	it("NON-MATCHING ROUTE - 404 but global middlewares still run", async () => {
		const hits: string[] = [];
		new TC.Route("/only-this", (c) => {
			c.data = "ok";
		});
		new TC.Middleware({
			useOn: "*",
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		const res = await s.handle(req("/does-not-exist"));
		expect(res.status).toBe(404);
		expect(hits).toEqual(["/does-not-exist"]);
	});

	it("STRING routeId REGISTRATION - matches the same route as the instance", async () => {
		const hits: string[] = [];
		const r = new TC.Route("/by-id", (c) => {
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: [r.id],
			handler: () => {
				hits.push("by-id");
			},
		});

		await s.handle(req("/by-id"));
		expect(hits).toEqual(["by-id"]);
	});

	it("SINGLE NON-ARRAY useOn - Route instance works without array wrapper", async () => {
		const hits: string[] = [];
		const r = new TC.Route("/single", (c) => {
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: r,
			handler: () => {
				hits.push("hit");
			},
		});

		await s.handle(req("/single"));
		expect(hits).toEqual(["hit"]);
	});

	it("SINGLE NON-ARRAY useOn - Controller works without array wrapper", async () => {
		const hits: string[] = [];
		const ctrl = createTestController("single-ctrl");

		new TC.Middleware({
			useOn: ctrl,
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		for (const id of ctrl.routeIds) {
			await s.handle(req(pathnameFromId(id)));
		}
		expect(hits).toEqual([...ctrl.routeIds].map(pathnameFromId));
	});

	it("DEFAULT VARIANT - omitting variant defaults to inbound", async () => {
		const order: string[] = [];
		const r = new TC.Route("/default-variant", (c) => {
			order.push("handler");
			c.data = "ok";
		});

		new TC.Middleware({
			useOn: [r],
			handler: () => {
				order.push("mw");
			},
		});

		await s.handle(req("/default-variant"));
		expect(order).toEqual(["mw", "handler"]);
	});

	it("OUTBOUND CAN MUTATE ctx.res - response body/status reflects outbound changes", async () => {
		const r = new TC.Route("/outbound-mutate", (c) => {
			c.data = { original: true };
		});

		new TC.Middleware({
			useOn: [r],
			handler: async (c, next) => {
				await next();
				c.res = new TC.Res({ replaced: true }, { status: 201 });
			},
		});

		const res = await s.handle(req("/outbound-mutate"));
		const data = await parseBody<{ replaced: boolean }>(res);
		expect(res.status).toBe(201);
		expect(data).toEqual({ replaced: true });
	});
});

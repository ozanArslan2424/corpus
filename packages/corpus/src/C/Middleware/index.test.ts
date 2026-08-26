import { describe, expect, it, beforeEach } from "bun:test";

import { objGetValues } from "@ozanarslan/utils";

import { $registry, C } from "#corpus";

import { createTestServer } from "../../../test/utils/createTestServer";
import { parseBody } from "../../../test/utils/parse";

beforeEach(() => {
	$registry.reset();
});

const s = createTestServer();
declare module "#corpus" {
	interface ContextDataInterface {
		order?: Array<string>;
	}
}
s.contextFactory = (request, server) => {
	const c = new C.Context(request, server);
	c.data.order = [];
	return c;
};

describe("Middleware", () => {
	it("calling next() twice throws", async () => {
		const r = new C.Route("/next-twice", () => "ok");
		new C.Middleware({
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
		const r = new C.Route("/m/1", (c) => {
			return c.data.order;
		});

		new C.Middleware({
			useOn: [r],
			handler: async (c, next) => {
				c.data.order?.push("a");
				await next();
			},
		});

		new C.Middleware({
			useOn: [r],
			handler: async (c, next) => {
				// The next middleware will be run before this
				await next();
				c.data.order?.push("c");
			},
		});

		new C.Middleware({
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
		const r1 = new C.Route("/c.data/1", (c) => {
			return c.data.order;
		});
		const r2 = new C.Route("/c.data/2", (c) => {
			return c.data.order;
		});
		new C.Middleware({
			useOn: [r1, r2],
			handler: async (c, next) => {
				c.data.order?.push("a");
				await next();
			},
		});

		new C.Middleware({
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
		const r = new C.Route("/order-out", () => {
			order.push("handler");
		});

		new C.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				order.push("o1");
			},
		});
		new C.Middleware({
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
		const r = new C.Route("/pipeline", () => {
			order.push("handler");
		});

		new C.Middleware({
			useOn: "*",
			handler: () => {
				order.push("g-in");
			},
		});
		new C.Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				order.push("g-out");
			},
		});
		new C.Middleware({
			useOn: [r],
			handler: () => {
				order.push("l-in");
			},
		});
		new C.Middleware({
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
		const r = new C.Route("/short-in", () => {
			order.push("handler");
		});

		new C.Middleware({
			useOn: [r],
			handler: () => {
				order.push("m1");
				return new C.Res({ intercepted: true }, { status: 418 });
			},
		});
		new C.Middleware({
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
		const r = new C.Route("/short-in/response", () => {
			return "response";
		});

		new C.Middleware({
			useOn: [r],
			handler: () => {
				return new C.Res({ intercepted: true }, { status: 418 });
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
		const rA = new C.Route("/mixA", () => "ok");
		const rB = new C.Route("/mixB", () => "ok");
		class TestController extends C.Controller {
			constructor() {
				super("/mixC");
			}

			cr1 = this.route("/cr1", (c) => c.data);
			cr2 = this.route("cr2", (c) => c.data);
		}

		const ctrl = new TestController();

		new C.Middleware({
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
		class TestController extends C.Controller {
			constructor() {
				super("fanout");
			}

			cr1 = this.route("/cr1", (c) => c.data);
			cr2 = this.route("cr2", (c) => c.data);
		}

		const ctrl = new TestController();

		new C.Middleware({
			useOn: [ctrl],
			handler: (c) => {
				hits.push(c.url.pathname);
			},
		});

		for (const val of objGetValues(ctrl)) {
			if (!(val instanceof C.BaseRoute)) continue;
			hits.length = 0;
			await s.handle(val.request({}));
			expect(hits).toEqual([val.endpoint]);
		}
	});

	it("same handler on same route runs twice", async () => {
		let count = 0;
		const r = new C.Route("/dup", () => "ok");
		const handler = () => {
			count++;
		};

		new C.Middleware({ useOn: [r], handler });
		new C.Middleware({ useOn: [r], handler });

		count = 0;
		await s.handle(r.request({}));
		expect(count).toBe(2);
	});

	it("outbound can mutate c.res instead of short-circuiting with C.Res", async () => {
		const r = new C.Route("/outbound-mutate", () => "ok");

		new C.Middleware({
			useOn: r,
			handler: async (c, next) => {
				await next();
				c.res = new C.Res({ replaced: true }, { status: 418 });
			},
		});

		const res = await s.handle(r.request({}));
		const data = await parseBody<{ replaced: boolean }>(res);
		expect(res.status).toBe(418);
		expect(data).toEqual({ replaced: true });
	});

	it("outbound middleware can return Res after next()", async () => {
		const r = new C.Route("/outbound-return", () => "ok");
		new C.Middleware({
			useOn: [r],
			handler: async (_, next) => {
				await next();
				return new C.Res({ replaced: true }, { status: 418 });
			},
		});
		const res = await s.handle(r.request({}));
		expect(res.status).toBe(418);
	});
});

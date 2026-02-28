import C from "@/index";
import { describe, expect, it } from "bun:test";
import { createTestServer } from "./utils/createTestServer";
import { createTestController } from "./utils/createTestController";
import { req } from "./utils/req";

const s = createTestServer();
const middlewareData = "Hello";
const overrideData = "world";
const r1 = new C.Route("/r1", (c) => c.data);
new C.Route("r2", (c) => c.data);
const c1 = createTestController("c1");
new C.Middleware({
	useOn: [r1, c1.cr1],
	handler: (c) => {
		c.data = middlewareData;
	},
});

const r3 = new C.Route("/r3", (c) => c.data);
new C.Middleware({
	useOn: [r3],
	handler: (c) => {
		c.data = { user: "john", role: "admin", count: 1 };
	},
});

const r4 = new C.Route("/r4", (c) => c.data);
new C.Middleware({
	useOn: [r4],
	handler: (c) => {
		c.data = { user: "john", role: "admin", count: 1 };
	},
});
new C.Middleware({
	useOn: [r4],
	handler: (c) => {
		(c.data as Record<string, unknown>).role = "superadmin";
		(c.data as Record<string, unknown>).count = 2;
	},
});

describe("C.Middleware", () => {
	it("ROUTE - APPLIES TO REGISTERED ROUTE", async () => {
		const res = await s.handle(req("/r1"));
		const data = await C.Parser.getBody<string>(res);
		expect(data).toBe(middlewareData);
	});

	it("ROUTE - DOES NOT APPLY TO UNREGISTERED ROUTE", async () => {
		const res = await s.handle(req("/r2"));
		const data = await C.Parser.getBody(res);
		expect(data).toBeEmptyObject();
	});

	it("CONTROLLER - APPLIES TO REGISTERED CONTROLLER ROUTE", async () => {
		const res = await s.handle(req("/c1/cr1"));
		const data = await C.Parser.getBody<string>(res);
		expect(data).toBe(middlewareData);
	});

	it("CONTROLLER - DOES NOT APPLY TO UNREGISTERED CONTROLLER ROUTE", async () => {
		const res = await s.handle(req("/c1/cr2"));
		const data = await C.Parser.getBody(res);
		expect(data).toBeEmptyObject();
	});

	it("ROUTE - OVERRIDES PREVIOUS MIDDLEWARE DATA", async () => {
		new C.Middleware({
			useOn: [r1],
			handler: (c) => {
				c.data = overrideData;
			},
		});
		const res = await s.handle(req("/r1"));
		const data = await C.Parser.getBody<string>(res);
		expect(data).toBe(overrideData);
	});

	it("ROUTE - SETS OBJECT DATA", async () => {
		const res = await s.handle(req("/r3"));
		const data = await C.Parser.getBody<Record<string, unknown>>(res);
		expect(data).toEqual({ user: "john", role: "admin", count: 1 });
	});

	it("ROUTE - MUTATES OBJECT DATA KEYS IN SUBSEQUENT MIDDLEWARE", async () => {
		const res = await s.handle(req("/r4"));
		const data = await C.Parser.getBody<Record<string, unknown>>(res);
		expect(data.user).toBe("john");
		expect(data.role).toBe("superadmin");
		expect(data.count).toBe(2);
	});
});

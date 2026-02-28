import C from "@/index";
import { describe, expect, it } from "bun:test";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

const s = createTestServer();

describe("C.Context", () => {
	it("HAS CORRECT SHAPE", async () => {
		new C.Route("/ctx-shape", (c) => {
			expect(c.req).toBeDefined();
			expect(c.url).toBeInstanceOf(URL);
			expect(c.headers).toBeInstanceOf(C.Headers);
			expect(c.cookies).toBeInstanceOf(C.Cookies);
			expect(c.res).toBeInstanceOf(C.Response);
			expect(c.body).toBeDefined();
			expect(c.search).toBeDefined();
			expect(c.params).toBeDefined();
			return "ok";
		});

		const res = await s.handle(req("/ctx-shape"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("BODY - JSON", async () => {
		new C.Route({ method: C.Method.POST, path: "/ctx-body-json" }, (c) => {
			expect(c.body).toEqual({ hello: "world" });
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-body-json", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ hello: "world" }),
			}),
		);
		expect(res.status).toBe(C.Status.OK);
	});

	it("BODY - FORM URLENCODED", async () => {
		new C.Route({ method: C.Method.POST, path: "/ctx-body-form" }, (c) => {
			expect(c.body).toEqual({ name: "john", age: 30 });
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-body-form", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "name=john&age=30",
			}),
		);
		expect(res.status).toBe(C.Status.OK);
	});

	it("BODY - EMPTY ON GET", async () => {
		new C.Route("/ctx-body-empty", (c) => {
			expect(c.body).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-body-empty"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("SEARCH - STRING VALUE", async () => {
		new C.Route("/ctx-search-string", (c) => {
			expect(c.search).toEqual({ q: "hello" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-string?q=hello"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("SEARCH - COERCES NUMBER", async () => {
		new C.Route("/ctx-search-number", (c) => {
			expect(c.search).toEqual({ page: 1 });
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-number?page=1"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("SEARCH - COERCES BOOLEAN", async () => {
		new C.Route("/ctx-search-bool", (c) => {
			expect(c.search).toEqual({ active: true });
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-bool?active=true"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("SEARCH - EMPTY WHEN NO PARAMS", async () => {
		new C.Route("/ctx-search-empty", (c) => {
			expect(c.search).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-empty"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("PARAMS - SINGLE PARAM", async () => {
		new C.Route("/ctx-params/:id", (c) => {
			expect(c.params).toEqual({ id: 123 });
			return "ok";
		});

		const res = await s.handle(req("/ctx-params/123"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("PARAMS - MULTIPLE PARAMS", async () => {
		new C.Route("/ctx-params/:org/:repo", (c) => {
			expect(c.params).toEqual({ org: "acme", repo: "web" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-params/acme/web"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("PARAMS - COERCES NUMBER", async () => {
		new C.Route("/ctx-params-num/:id", (c) => {
			expect(c.params).toEqual({ id: 42 });
			return "ok";
		});

		const res = await s.handle(req("/ctx-params-num/42"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("PARAMS - EMPTY WHEN NO PARAMS IN PATTERN", async () => {
		new C.Route("/ctx-params-none", (c) => {
			expect(c.params).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-params-none"));
		expect(res.status).toBe(C.Status.OK);
	});

	it("RES - SET STATUS", async () => {
		new C.Route("/ctx-res-status", (c) => {
			c.res.status = C.Status.CREATED;
			return "created";
		});

		const res = await s.handle(req("/ctx-res-status"));
		expect(res.status).toBe(C.Status.CREATED);
	});

	it("RES - SET HEADER", async () => {
		new C.Route("/ctx-res-header", (c) => {
			c.res.headers.set("x-custom", "test-value");
			return "ok";
		});

		const res = await s.handle(req("/ctx-res-header"));
		expect(res.headers.get("x-custom")).toBe("test-value");
	});

	it("RES - SET COOKIE", async () => {
		new C.Route("/ctx-res-cookie", (c) => {
			c.res.cookies.set({ name: "session", value: "abc123" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-res-cookie"));
		expect(res.headers.get(C.CommonHeaders.SetCookie)).toContain(
			"session=abc123",
		);
	});

	it("REQ - READ COOKIE", async () => {
		new C.Route("/ctx-req-cookie", (c) => {
			expect(c.cookies.get("session")).toBe("abc123");
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-req-cookie", {
				headers: { cookie: "session=abc123" },
			}),
		);
		expect(res.status).toBe(C.Status.OK);
	});

	it("REQ - READ HEADER", async () => {
		new C.Route("/ctx-req-header", (c) => {
			expect(c.headers.get("x-custom")).toBe("test-value");
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-req-header", {
				headers: { "x-custom": "test-value" },
			}),
		);
		expect(res.status).toBe(C.Status.OK);
	});
});

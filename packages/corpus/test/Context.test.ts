import { beforeEach, describe, expect, it } from "bun:test";

import { type } from "arktype";

import { $registryTesting, TC, type RouterReturn } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

beforeEach(() => $registryTesting.reset());

const s = createTestServer();

describe("C.Context", () => {
	it("HAS CORRECT SHAPE", async () => {
		new TC.Route("/ctx-shape", (c) => {
			expect(c.req).toBeInstanceOf(TC.Req);
			expect(c.url).toBeInstanceOf(URL);
			expect(c.headers).toBeInstanceOf(Headers);
			expect(c.cookies).toBeInstanceOf(TC.Cookies);
			expect(c.res).toBeInstanceOf(TC.Res);
			expect(c.body).toBeDefined();
			expect(c.search).toBeDefined();
			expect(c.params).toBeDefined();
			return "ok";
		});

		const res = await s.handle(req("/ctx-shape"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("APPENDS CORRECT PARSED DATA", async () => {
		const r = new TC.Req("http://localhost:3000/hello/randomID?a=b", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hello: "world" }),
		});
		const fakeRouterReturn: RouterReturn = {
			params: { id: "randomID" },
			route: {
				endpoint: "/hello/:id",
				id: "POST /hello/:id",
				handler: () => {},
				method: "POST",
				variant: "dynamic",
				validators: undefined,
			},
		};

		const c = new TC.Context(r);
		expect(c.body).toBeEmptyObject();
		expect(c.search).toBeEmptyObject();
		expect(c.params).toBeEmptyObject();

		await TC.Context.appendParsedData(c, fakeRouterReturn);

		expect(c.body).toEqual({ hello: "world" });
		expect(c.params).toEqual(fakeRouterReturn.params);
	});

	it("BODY - JSON", async () => {
		new TC.Route({ method: TC.Method.POST, path: "/ctx-body-json" }, (c) => {
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
		expect(res.status).toBe(TC.Status.OK);
	});

	it("BODY - FORM URLENCODED", async () => {
		new TC.Route(
			{ method: TC.Method.POST, path: "/ctx-body-form" },
			(c) => {
				expect(c.body).toEqual({ name: "john", age: 30 });
				return "ok";
			},
			{
				body: type({
					name: "string",
					age: "number",
				}),
			},
		);

		const res = await s.handle(
			req("/ctx-body-form", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "name=john&age=30",
			}),
		);
		expect(res.status).toBe(TC.Status.OK);
	});

	it("BODY - EMPTY ON GET", async () => {
		new TC.Route("/ctx-body-empty", (c) => {
			expect(c.body).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-body-empty"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("SEARCH - STRING VALUE", async () => {
		new TC.Route("/ctx-search-string", (c) => {
			expect(c.search).toEqual({ q: "hello" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-string?q=hello"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("SEARCH - EMPTY WHEN NO PARAMS", async () => {
		new TC.Route("/ctx-search-empty", (c) => {
			expect(c.search).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-search-empty"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("PARAMS - SINGLE PARAM", async () => {
		new TC.Route("/ctx-params/:id", (c) => {
			expect(c.params).toEqual({ id: 123 });
			return "ok";
		});

		const res = await s.handle(req("/ctx-params/123"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("PARAMS - MULTIPLE PARAMS", async () => {
		new TC.Route("/ctx-many-params/:org/:repo", (c) => {
			expect(c.params).toEqual({ org: "acme", repo: "web" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-many-params/acme/web"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("PARAMS - EMPTY WHEN NO PARAMS IN PATTERN", async () => {
		new TC.Route("/ctx-params-none", (c) => {
			expect(c.params).toBeEmptyObject();
			return "ok";
		});

		const res = await s.handle(req("/ctx-params-none"));
		expect(res.status).toBe(TC.Status.OK);
	});

	it("RES - SET STATUS", async () => {
		new TC.Route("/ctx-res-status", (c) => {
			c.res.status = TC.Status.CREATED;
			return "created";
		});

		const res = await s.handle(req("/ctx-res-status"));
		expect(res.status).toBe(TC.Status.CREATED);
	});

	it("RES - SET HEADER", async () => {
		new TC.Route("/ctx-res-header", (c) => {
			c.res.headers.set("x-custom", "test-value");
			return "ok";
		});

		const res = await s.handle(req("/ctx-res-header"));
		expect(res.headers.get("x-custom")).toBe("test-value");
	});

	it("RES - SET COOKIE", async () => {
		new TC.Route("/ctx-res-cookie", (c) => {
			c.res.cookies.set({ name: "session", value: "abc123" });
			return "ok";
		});

		const res = await s.handle(req("/ctx-res-cookie"));
		expect(res.headers.get(TC.HeaderKey.SetCookie)).toContain("session=abc123");
	});

	it("REQ - READ COOKIE", async () => {
		new TC.Route("/ctx-req-cookie", (c) => {
			expect(c.cookies.get("session")).toBe("abc123");
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-req-cookie", {
				headers: { cookie: "session=abc123" },
			}),
		);
		expect(res.status).toBe(TC.Status.OK);
	});

	it("REQ - READ HEADER", async () => {
		new TC.Route("/ctx-req-header", (c) => {
			expect(c.headers.get("x-custom")).toBe("test-value");
			return "ok";
		});

		const res = await s.handle(
			req("/ctx-req-header", {
				headers: { "x-custom": "test-value" },
			}),
		);
		expect(res.status).toBe(TC.Status.OK);
	});
});

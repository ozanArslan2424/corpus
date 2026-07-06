import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

beforeEach(() => $registryTesting.reset());

const s = createTestServer();

describe("C.Route", () => {
	const handler = () => "ok";

	it("STRING DEFINITION DEFAULTS TO GET", () => {
		const path = "/r1";
		const route = new TC.Route(path, handler);

		expect(route.variant).toBe("dynamic");
		expect(route.method).toBe(TC.Method.GET);
		expect(route.endpoint).toBe(path);
		expect(route.id).toBe(`${TC.Method.GET} ${path}`);
	});

	it("OBJECT DEFINITION WITH METHOD", () => {
		const path = "/r2";
		const route = new TC.Route({ method: TC.Method.POST, path }, handler);

		expect(route.method).toBe(TC.Method.POST);
		expect(route.endpoint).toBe(path);
		expect(route.id).toBe(`${TC.Method.POST} ${path}`);
	});

	it("REGISTERS TO ROUTER", async () => {
		const path = "/r5";
		new TC.Route(path, () => "registered");

		const res = await s.handle(req(path));
		expect(res.status).toBe(200);
	});

	it("REGISTERS CORRECT METHOD FROM ADDRESS (object)", async () => {
		new TC.Route({ method: TC.Method.POST, path: "/r6" }, () => "posted");

		const res = await s.handle(req("/r6", { method: "POST" }));
		expect(res.status).toBe(200);
	});

	it("REGISTERS CORRECT METHOD FROM ADDRESS (inlined)", async () => {
		new TC.Route("POST /r7", () => "posted");

		const res = await s.handle(req("/r7", { method: "POST" }));
		expect(res.status).toBe(200);
	});

	it("REGISTERS CORRECT METHOD FROM ADDRESS (missing)", async () => {
		new TC.Route("/r7-g", () => "got");

		const res = await s.handle(req("/r7-g", { method: "GET" }));
		expect(res.status).toBe(200);
	});

	it("REGISTERS CORRECT METHOD AND ENDPOINT FROM ADDRESS (no slash)", async () => {
		new TC.Route("r7-1", () => "got");
		new TC.Route("POST r7-2", () => "posted");

		const res1 = await s.handle(req("/r7-1", { method: "GET" }));
		expect(res1.status).toBe(200);
		const res2 = await s.handle(req("/r7-2", { method: "POST" }));
		expect(res2.status).toBe(200);
	});

	it("WITH MODEL", () => {
		const path = "/r8";
		const model = { response: undefined, body: undefined };
		const route = new TC.Route(path, handler, model);

		expect(route.model).toBe(model);
	});

	it("WITHOUT MODEL", () => {
		const path = "/r9";
		const route = new TC.Route(path, handler);

		expect(route.model).toBeUndefined();
	});

	it.each(Object.values(TC.Method))("METHOD %s RESOLVES CORRECTLY", (method) => {
		const path = `/${method.toLowerCase()}-method-test`;
		const route = new TC.Route({ method, path }, handler);

		expect(route.method).toBe(method);
		expect(route.id).toBe(`${method} ${path}`);
	});

	it("USING EXTENDED ABSTRACT METHOD", async () => {
		const path = "/r-extended";

		class MyRoute extends TC.RouteAbstract {
			constructor() {
				super();
				this.register();
			}

			override endpoint: string = path;
			override method: TC.Method = TC.Method.GET;
			callback: TC.RouteCallback = () => "extended";
		}

		new MyRoute();
		const res = await s.handle(req(path));
		expect(res.status).toBe(200);
	});
});

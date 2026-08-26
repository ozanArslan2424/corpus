import { beforeEach, describe, expect, it } from "bun:test";

import { $registry, C } from "#corpus";

import { createTestServer } from "../../../test/utils/createTestServer";
import { req } from "../../../test/utils/req";

beforeEach(() => $registry.reset());

const s = createTestServer();

describe("Route", () => {
	const handler = () => "ok";

	it("string definition defaults to get", () => {
		const path = "/r1";
		const route = new C.Route(path, handler);

		expect(route.variant).toBe("dynamic");
		expect(route.method).toBe(C.Method.GET);
		expect(route.endpoint).toBe(path);
		expect(route.id).toBe(`${C.Method.GET} ${path}`);
	});

	it("object definition with method", () => {
		const path = "/r2";
		const route = new C.Route({ method: C.Method.POST, path }, handler);

		expect(route.method).toBe(C.Method.POST);
		expect(route.endpoint).toBe(path);
		expect(route.id).toBe(`${C.Method.POST} ${path}`);
	});

	it("registers to router", async () => {
		const path = "/r5";
		new C.Route(path, () => "registered");

		const res = await s.handle(req(path));
		expect(res.status).toBe(200);
	});

	it("registers correct method from address (object)", async () => {
		new C.Route({ method: C.Method.POST, path: "/r6" }, () => "posted");

		const res = await s.handle(req("/r6", { method: "POST" }));
		expect(res.status).toBe(200);
	});

	it("registers correct method from address (inlined)", async () => {
		new C.Route("POST /r7", () => "posted");

		const res = await s.handle(req("/r7", { method: "POST" }));
		expect(res.status).toBe(200);
	});

	it("registers correct method from address (missing)", async () => {
		new C.Route("/r7-g", () => "got");

		const res = await s.handle(req("/r7-g", { method: "GET" }));
		expect(res.status).toBe(200);
	});

	it("registers correct method and endpoint from address (no slash)", async () => {
		new C.Route("r7-1", () => "got");
		new C.Route("POST r7-2", () => "posted");

		const res1 = await s.handle(req("/r7-1", { method: "GET" }));
		expect(res1.status).toBe(200);
		const res2 = await s.handle(req("/r7-2", { method: "POST" }));
		expect(res2.status).toBe(200);
	});

	it("with model", () => {
		const path = "/r8";
		const model = { response: undefined, body: undefined };
		const route = new C.Route(path, handler, model);

		expect(route.model).toBe(model);
	});

	it("without model", () => {
		const path = "/r9";
		const route = new C.Route(path, handler);

		expect(route.model).toBeUndefined();
	});

	it.each(Object.values(C.Method))("method %s resolves correctly", (method) => {
		const path = `/${method.toLowerCase()}-method-test`;
		const route = new C.Route({ method, path }, handler);

		expect(route.method).toBe(method);
		expect(route.id).toBe(`${method} ${path}`);
	});

	it("using extended abstract method", async () => {
		const path = "/r-extended";

		class MyRoute extends C.RouteAbstract {
			constructor() {
				super();
				this.register();
			}

			override endpoint: string = path;
			override method: C.Method = C.Method.GET;
			override handler = () => "extended";
		}

		new MyRoute();
		const res = await s.handle(req(path));
		expect(res.status).toBe(200);
	});
});

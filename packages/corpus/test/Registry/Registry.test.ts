import { beforeEach, describe, expect, it } from "bun:test";

import { MiddlewareRouter } from "@/Router/MiddlewareRouter";

import type { RouterAdapterInterface, RouterData, RouterReturn } from "../_modules";
import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { parseBody } from "../utils/parse";
import { req } from "../utils/req";

beforeEach(() => {
	$registryTesting.reset();
});

describe("Registry - plug & play", () => {
	it("reset() reinstantiates every field", () => {
		const before = {
			adapter: $registryTesting.adapter,
			router: $registryTesting.router,
			middlewares: $registryTesting.middlewares,
			urlParamsParser: $registryTesting.urlParamsParser,
			searchParamsParser: $registryTesting.searchParamsParser,
			formDataParser: $registryTesting.formDataParser,
			bodyParser: $registryTesting.bodyParser,
			schemaParser: $registryTesting.schemaParser,
			docs: $registryTesting.docs,
			cors: $registryTesting.cors,
			prefix: $registryTesting.prefix,
		};

		$registryTesting.reset();

		expect($registryTesting.adapter).not.toBe(before.adapter);
		expect($registryTesting.router).not.toBe(before.router);
		expect($registryTesting.middlewares).not.toBe(before.middlewares);
		expect($registryTesting.urlParamsParser).not.toBe(before.urlParamsParser);
		expect($registryTesting.searchParamsParser).not.toBe(before.searchParamsParser);
		expect($registryTesting.formDataParser).not.toBe(before.formDataParser);
		expect($registryTesting.bodyParser).not.toBe(before.bodyParser);
		expect($registryTesting.schemaParser).not.toBe(before.schemaParser);
		expect($registryTesting.docs).not.toBe(before.docs);
		expect($registryTesting.cors).toBeNull();
		expect($registryTesting.prefix).toBe("");
	});

	it("setting adapter replaces router with one wrapping the new adapter", () => {
		const oldRouter = $registryTesting.router;
		const customAdapter: RouterAdapterInterface = {
			__brand: "customAdapter",
			add: () => {},
			find: () => null,
			list: () => [],
		};

		$registryTesting.adapter = customAdapter;

		expect($registryTesting.adapter).toBe(customAdapter);
		expect($registryTesting.router).not.toBe(oldRouter);
	});
});

describe("Registry - swapped fields are honored by the server", () => {
	it("custom adapter's find() is the one the server calls", async () => {
		const findCalls: string[] = [];
		const addCalls: string[] = [];

		let capturedData: RouterData | null = null;
		const customAdapter: RouterAdapterInterface = {
			__brand: "customAdapter",
			add: (data) => {
				addCalls.push(data.id);
				capturedData = data;
			},
			find: (r: TC.Req) => {
				findCalls.push(r.urlObject.pathname);
				if (!capturedData) return null;
				return { route: capturedData, params: {} } as RouterReturn;
			},
			list: () => (capturedData ? [capturedData] : []),
		};

		$registryTesting.adapter = customAdapter;

		// Route must be constructed AFTER the swap so it registers on the new adapter
		new TC.Route("/custom-adapter", () => {
			return "from-custom-adapter";
		});

		const s = createTestServer();
		const res = await s.handle(req("/custom-adapter"));
		const data = await parseBody<string>(res);

		expect(addCalls).toHaveLength(1);
		expect(findCalls).toEqual(["/custom-adapter"]);
		expect(data).toBe("from-custom-adapter");
	});

	it("custom middlewares router is the one the server calls find() on", async () => {
		const findCalls: string[] = [];
		const addCalls: number[] = [];
		let addCount = 0;

		// Delegate to real MiddlewareRouter for correctness, spy on the calls.
		const real = new MiddlewareRouter();
		$registryTesting.middlewares = {
			add: (mw) => {
				addCalls.push(++addCount);
				real.add(mw as any);
			},
			find: (routeId) => {
				findCalls.push(routeId);
				return real.find(routeId) as any;
			},
		};

		const r = new TC.Route("/custom-mw", (c) => {
			return c.data;
		});
		new TC.Middleware({
			variant: "inbound",
			useOn: [r],
			handler: (c) => {
				c.data = "mutated-by-mw";
			},
		});

		const s = createTestServer();
		const res = await s.handle(req("/custom-mw"));
		const data = await parseBody<string>(res);

		expect(addCalls).toHaveLength(1);
		// Server calls find("*") for globals, then find(route.id) for locals.
		expect(findCalls).toContain("*");
		expect(findCalls).toContain(r.id);
		expect(data).toBe("mutated-by-mw");
	});

	it("custom cors handler runs after the route", async () => {
		let corsCalls = 0;
		$registryTesting.cors = {
			register: () => {},
			useOn: "*",
			variant: "outbound",
			handler: () => {
				corsCalls++;
			},
			handlePreflight: () => new TC.Res(null, { status: 204 }),
		} as typeof $registryTesting.cors extends infer T ? T : never; // cast to CorsInterface

		new TC.Route("/cors-route", (c) => {
			c.data = "ok";
		});

		const s = createTestServer();
		await s.handle(req("/cors-route"));

		expect(corsCalls).toBe(1);
	});

	it("setting cors to null disables the handler", async () => {
		$registryTesting.cors = null;

		new TC.Route("/no-cors", (c) => {
			c.data = "ok";
		});

		const s = createTestServer();
		const res = await s.handle(req("/no-cors"));
		expect(res.status).toBe(200);
	});

	it("swap persists across multiple requests", async () => {
		const findCalls: string[] = [];
		let capturedData: RouterData | null = null;
		$registryTesting.adapter = {
			__brand: "adaptertest",
			add: (data) => {
				capturedData = data;
			},
			find: (r: TC.Req) => {
				findCalls.push(r.urlObject.pathname);
				if (!capturedData) return null;
				if (r.urlObject.pathname !== capturedData.endpoint) return null;
				return { route: capturedData, params: {} } as RouterReturn;
			},
			list: () => (capturedData ? [capturedData] : []),
		};

		new TC.Route("/persist", (c) => {
			c.data = "ok";
		});

		const s = createTestServer();
		await s.handle(req("/persist"));
		await s.handle(req("/persist"));
		await s.handle(req("/persist"));

		expect(findCalls).toEqual(["/persist", "/persist", "/persist"]);
	});

	it("reset() restores defaults after a swap", () => {
		const custom: RouterAdapterInterface = {
			__brand: "custom",
			add: () => {},
			find: () => null,
			list: () => [],
		};
		$registryTesting.adapter = custom;
		expect($registryTesting.adapter).toBe(custom);

		$registryTesting.reset();
		expect($registryTesting.adapter).not.toBe(custom);
	});
});

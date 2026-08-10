import { beforeEach, describe, expect, it } from "bun:test";

import type { RouterInterface, RouterReturn, BaseRoute } from "../_modules";
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
			router: $registryTesting.router,
			middlewares: $registryTesting.middlewareRouter,
			urlParamsParser: $registryTesting.urlParamsParser,
			searchParamsParser: $registryTesting.searchParamsParser,
			formDataParser: $registryTesting.formDataParser,
			bodyParser: $registryTesting.bodyParser,
			schemaParser: $registryTesting.schemaParser,
			cors: $registryTesting.cors,
			prefix: $registryTesting.prefix,
		};

		$registryTesting.reset();

		expect($registryTesting.router).not.toBe(before.router);
		expect($registryTesting.middlewareRouter).not.toBe(before.middlewares);
		expect($registryTesting.urlParamsParser).not.toBe(before.urlParamsParser);
		expect($registryTesting.searchParamsParser).not.toBe(before.searchParamsParser);
		expect($registryTesting.formDataParser).not.toBe(before.formDataParser);
		expect($registryTesting.bodyParser).not.toBe(before.bodyParser);
		expect($registryTesting.schemaParser).not.toBe(before.schemaParser);
		expect($registryTesting.prefix).toBe("");
	});
});

describe("Registry - swapped fields are honored by the server", () => {
	it("custom router's find() is the one the server calls", async () => {
		const findCalls: string[] = [];
		const addCalls: string[] = [];

		let capturedData: BaseRoute | null = null;
		const customRouter: RouterInterface = {
			__brand: "customRouter",
			add: (data) => {
				addCalls.push(data.id);
				capturedData = data;
			},
			find: (_method: TC.Method, url: string) => {
				const pathname = new URL(url).pathname;
				findCalls.push(pathname);
				if (!capturedData) return null;
				return { route: capturedData, params: {} } as RouterReturn;
			},
			list: () => (capturedData ? [capturedData] : []),
		};

		$registryTesting.router = customRouter;

		// Route must be constructed AFTER the swap so it registers on the new router
		new TC.Route("/custom-router", () => {
			return "from-custom-router";
		});

		const s = createTestServer();
		const res = await s.handle(req("/custom-router"));
		const data = await parseBody<string>(res);

		expect(addCalls).toHaveLength(1);
		expect(findCalls).toEqual(["/custom-router"]);
		expect(data).toBe("from-custom-router");
	});
	//
	// it("custom middlewares router is the one the server calls find() on", async () => {
	// 	const findCalls: string[] = [];
	// 	const addCalls: number[] = [];
	// 	let addCount = 0;
	//
	// 	// Delegate to real MiddlewareRouter for correctness, spy on the calls.
	// 	const real = new MiddlewareRouter();
	// 	$registryTesting.middlewareRouter = {
	// 		add: (mw) => {
	// 			addCalls.push(++addCount);
	// 			real.add(mw as any);
	// 		},
	// 		find: (routeId) => {
	// 			findCalls.push(routeId);
	// 			return real.find(routeId) as any;
	// 		},
	// 	};
	//
	// 	const r = new TC.Route("/custom-mw", (c) => {
	// 		return c.data;
	// 	});
	// 	new TC.Middleware({
	// 		variant: "inbound",
	// 		useOn: [r],
	// 		handler: (c) => {
	// 			c.data = "mutated-by-mw";
	// 		},
	// 	});
	//
	// 	const s = createTestServer();
	// 	const res = await s.handle(req("/custom-mw"));
	// 	const data = await parseBody<string>(res);
	//
	// 	expect(addCalls).toHaveLength(1);
	// 	// Server calls find("*") for globals, then find(route.id) for locals.
	// 	expect(findCalls).toContain("*");
	// 	expect(findCalls).toContain(r.id);
	// 	expect(data).toBe("mutated-by-mw");
	// });

	it("custom cors handler runs after the route", async () => {
		let corsCalls = 0;
		$registryTesting.cors = {
			register: () => {},
			useOn: "*",
			handler: async (_, next) => {
				await next();
				corsCalls++;
			},
			handlePreflight: () => new TC.Res(null, { status: 204 }),
		};

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
		let capturedData: BaseRoute | null = null;
		$registryTesting.router = {
			__brand: "routertest",
			add: (data) => {
				capturedData = data;
			},
			find: (_method: TC.Method, url: string) => {
				const pathname = new URL(url).pathname;
				findCalls.push(pathname);
				if (!capturedData) return null;
				if (pathname !== capturedData.endpoint) return null;
				return { route: capturedData, params: {} };
			},
			list: () => (capturedData ? [capturedData] : []),
		};

		// same method and route stops at the router cache layer
		// hence the different paths
		new TC.Route("/persist", (c) => {
			c.data = "ok";
		});
		new TC.Route("/persist2", (c) => {
			c.data = "ok";
		});
		new TC.Route("/persist3", (c) => {
			c.data = "ok";
		});

		const s = createTestServer();
		await s.handle(req("/persist"));
		await s.handle(req("/persist2"));
		await s.handle(req("/persist3"));

		expect(findCalls).toEqual(["/persist", "/persist2", "/persist3"]);
	});

	it("reset() restores defaults after a swap", () => {
		const custom: RouterInterface = {
			__brand: "custom",
			add: () => {},
			find: () => null,
			list: () => [],
		};
		$registryTesting.router = custom;
		expect($registryTesting.router).toBe(custom);

		$registryTesting.reset();
		expect($registryTesting.router).not.toBe(custom);
	});
});

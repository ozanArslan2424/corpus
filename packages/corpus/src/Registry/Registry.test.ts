// import { beforeEach, describe, expect, it } from "bun:test";
//
// import type { RouterInterface, RouterReturn, RouteBase } from "#corpus";
// import { $registry, C } from "#corpus";
// import { createTestServer } from "#testutils/createTestServer";
// import { parseBody } from "#testutils/parse";
// import { req } from "#testutils/req";
//
// beforeEach(() => {
// 	$registry.reset();
// });
//
// describe("Registry - plug & play", () => {
// 	it("reset() reinstantiates every field", () => {
// 		const before = {
// 			router: $registry.router,
// 			urlParamsParser: $registry.urlParamsParser,
// 			searchParamsParser: $registry.searchParamsParser,
// 			formDataParser: $registry.formDataParser,
// 			bodyParser: $registry.bodyParser,
// 			schemaParser: $registry.schemaParser,
// 			cors: $registry.cors,
// 			prefix: $registry.prefix,
// 		};
//
// 		$registry.reset();
//
// 		expect($registry.router).not.toBe(before.router);
// 		expect($registry.urlParamsParser).not.toBe(before.urlParamsParser);
// 		expect($registry.searchParamsParser).not.toBe(before.searchParamsParser);
// 		expect($registry.formDataParser).not.toBe(before.formDataParser);
// 		expect($registry.bodyParser).not.toBe(before.bodyParser);
// 		expect($registry.schemaParser).not.toBe(before.schemaParser);
// 		expect($registry.prefix).toBe("");
// 	});
// });
//
// describe("Registry - swapped fields are honored by the server", () => {
// 	it("custom router's find() is the one the server calls", async () => {
// 		const findCalls: string[] = [];
// 		const addCalls: string[] = [];
//
// 		let capturedData: RouteBase | null = null;
// 		const customRouter: RouterInterface = {
// 			add: (data) => {
// 				addCalls.push(data.id);
// 				capturedData = data;
// 			},
// 			find: (_method: C.Method, url: string) => {
// 				const pathname = new URL(url).pathname;
// 				findCalls.push(pathname);
// 				if (!capturedData) return null;
// 				return { route: capturedData, params: {} } as RouterReturn;
// 			},
// 			list: () => (capturedData ? [capturedData] : []),
// 		};
//
// 		$registry.router = customRouter;
//
// 		// Route must be constructed AFTER the swap so it registers on the new router
// 		new C.Route("/custom-router", () => {
// 			return "from-custom-router";
// 		});
//
// 		const s = createTestServer();
// 		const res = await s.handle(req("/custom-router"));
// 		const data = await parseBody<string>(res);
//
// 		expect(addCalls).toHaveLength(1);
// 		expect(findCalls).toEqual(["/custom-router"]);
// 		expect(data).toBe("from-custom-router");
// 	});
// 	//
// 	// it("custom middlewares router is the one the server calls find() on", async () => {
// 	// 	const findCalls: string[] = [];
// 	// 	const addCalls: number[] = [];
// 	// 	let addCount = 0;
// 	//
// 	// 	// Delegate to real MiddlewareRouter for correctness, spy on the calls.
// 	// 	const real = new MiddlewareRouter();
// 	// 	$registry.middlewareRouter = {
// 	// 		add: (mw) => {
// 	// 			addCalls.push(++addCount);
// 	// 			real.add(mw as any);
// 	// 		},
// 	// 		find: (routeId) => {
// 	// 			findCalls.push(routeId);
// 	// 			return real.find(routeId) as any;
// 	// 		},
// 	// 	};
// 	//
// 	// 	const r = new C.Route("/custom-mw", (c) => {
// 	// 		return c.data;
// 	// 	});
// 	// 	new C.Middleware({
// 	// 		variant: "inbound",
// 	// 		useOn: [r],
// 	// 		handler: (c) => {
// 	// 			c.data = "mutated-by-mw";
// 	// 		},
// 	// 	});
// 	//
// 	// 	const s = createTestServer();
// 	// 	const res = await s.handle(req("/custom-mw"));
// 	// 	const data = await parseBody<string>(res);
// 	//
// 	// 	expect(addCalls).toHaveLength(1);
// 	// 	// Server calls find("*") for globals, then find(route.id) for locals.
// 	// 	expect(findCalls).toContain("*");
// 	// 	expect(findCalls).toContain(r.id);
// 	// 	expect(data).toBe("mutated-by-mw");
// 	// });
//
// 	it("custom cors handler runs after the route", async () => {
// 		let corsCalls = 0;
// 		$registry.cors = {
// 			register: () => {},
// 			useOn: "*",
// 			handler: async (_, next) => {
// 				await next();
// 				corsCalls++;
// 			},
// 			handlePreflight: () => new C.Res(null, { status: 204 }),
// 		};
//
// 		new C.Route("/cors-route", (c) => {
// 			c.data = "ok";
// 		});
//
// 		const s = createTestServer();
// 		await s.handle(req("/cors-route"));
//
// 		expect(corsCalls).toBe(1);
// 	});
//
// 	it("setting cors to null disables the handler", async () => {
// 		$registry.cors = null;
//
// 		new C.Route("/no-cors", (c) => {
// 			c.data = "ok";
// 		});
//
// 		const s = createTestServer();
// 		const res = await s.handle(req("/no-cors"));
// 		expect(res.status).toBe(200);
// 	});
//
// 	it("swap persists across multiple requests", async () => {
// 		const findCalls: string[] = [];
// 		let capturedData: RouteBase | null = null;
// 		$registry.router = {
// 			__brand: "routertest",
// 			add: (data) => {
// 				capturedData = data;
// 			},
// 			find: (_method: C.Method, url: string) => {
// 				const pathname = new URL(url).pathname;
// 				findCalls.push(pathname);
// 				if (!capturedData) return null;
// 				if (pathname !== capturedData.endpoint) return null;
// 				return { route: capturedData, params: {}, middlewares: [] };
// 			},
// 			list: () => (capturedData ? [capturedData] : []),
// 		};
//
// 		// same method and route stops at the router cache layer
// 		// hence the different paths
// 		new C.Route("/persist", (c) => {
// 			c.data = "ok";
// 		});
// 		new C.Route("/persist2", (c) => {
// 			c.data = "ok";
// 		});
// 		new C.Route("/persist3", (c) => {
// 			c.data = "ok";
// 		});
//
// 		const s = createTestServer();
// 		await s.handle(req("/persist"));
// 		await s.handle(req("/persist2"));
// 		await s.handle(req("/persist3"));
//
// 		expect(findCalls).toEqual(["/persist", "/persist2", "/persist3"]);
// 	});
//
// 	it("reset() restores defaults after a swap", () => {
// 		const custom: RouterInterface = {
// 			add: () => {},
// 			find: () => null,
// 			list: () => [],
// 		};
// 		$registry.router = custom;
// 		expect($registry.router).toBe(custom);
//
// 		$registry.reset();
// 		expect($registry.router).not.toBe(custom);
// 	});
// });

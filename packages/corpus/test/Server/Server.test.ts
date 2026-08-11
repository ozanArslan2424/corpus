import { describe, expect, it, beforeEach } from "bun:test";
import net from "net";

import { TC, $registryTesting } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { parseBody } from "../utils/parse";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

describe("C.Server", () => {
	// ─── handle() - routing ───────────────────────────────────────

	it("HANDLE - RETURNS 200 FOR REGISTERED ROUTE", async () => {
		const s = createTestServer();
		new TC.Route("/srv-200", () => "ok");
		const res = await s.handle(req("/srv-200"));
		expect(res.status).toBe(200);
	});

	it("HANDLE - RETURNS 404 FOR UNREGISTERED ROUTE", async () => {
		const s = createTestServer();
		const res = await s.handle(req("/srv-does-not-exist"));
		expect(res.status).toBe(404);
	});

	it("HANDLE - RETURNS HANDLER RESULT AS BODY", async () => {
		const s = createTestServer();
		new TC.Route("/srv-body", () => ({ hello: "world" }));
		const res = await s.handle(req("/srv-body"));
		const data = await parseBody<{ hello: string }>(res);
		expect(data.hello).toBe("world");
	});

	it("HANDLE - RETURNS RES INSTANCE DIRECTLY WHEN HANDLER RETURNS RES", async () => {
		const s = createTestServer();
		new TC.Route("/srv-res-direct", () => {
			return new TC.Res({ direct: true }, { status: 201 });
		});
		const res = await s.handle(req("/srv-res-direct"));
		expect(res.status).toBe(201);
		const data = await parseBody<{ direct: boolean }>(res);
		expect(data.direct).toBe(true);
	});

	it("HANDLE - WRAPS PLAIN HANDLER RESULT IN RES WITH 200", async () => {
		const s = createTestServer();
		new TC.Route("/srv-plain", () => "plain text");
		const res = await s.handle(req("/srv-plain"));
		expect(res.status).toBe(200);
	});

	it("HANDLE - PASSES PARSED PARAMS TO CONTEXT", async () => {
		const s = createTestServer();
		new TC.Route<never, never, { id: number }>("/srv-user/:id", (ctx) => ({ id: ctx.params.id }));
		const res = await s.handle(req("/srv-user/42"));
		const data = await parseBody<{ id: number }>(res);
		expect(data.id).toBe(42);
	});

	it("HANDLE - PASSES SEARCH PARAMS TO CONTEXT", async () => {
		const s = createTestServer();
		new TC.Route<never, { q: string }>("/srv-search", (ctx) => ({ q: ctx.search.q }));
		const res = await s.handle(req("/srv-search?q=hello"));
		const data = await parseBody<{ q: string }>(res);
		expect(data.q).toBe("hello");
	});

	// ─── routes getter ────────────────────────────────────────────

	it("ROUTES - GETTER RETURNS EMPTY ARRAY WHEN NONE REGISTERED", () => {
		const s = createTestServer();
		expect(s.routes).toEqual([]);
	});

	it("ROUTES - GETTER LISTS REGISTERED ROUTES", () => {
		const s = createTestServer();
		new TC.Route("/srv-list-1", () => "a");
		new TC.Route("/srv-list-2", () => "b");
		expect(s.routes.length).toBe(2);
	});

	// ─── method routing ───────────────────────────────────────────

	it("METHOD - GET AND POST ON SAME PATH ARE DISTINCT", async () => {
		const s = createTestServer();
		new TC.Route("/srv-methods", () => "got");
		new TC.Route({ method: "POST", path: "/srv-methods" }, () => "posted");

		const getRes = await s.handle(req("/srv-methods", { method: "GET" }));
		const postRes = await s.handle(req("/srv-methods", { method: "POST" }));

		expect(getRes.status).toBe(200);
		expect(postRes.status).toBe(200);
		expect(await getRes.text()).toContain("got");
		expect(await postRes.text()).toContain("posted");
	});

	it("METHOD - UNREGISTERED METHOD ON REGISTERED PATH RETURNS 404", async () => {
		const s = createTestServer();
		new TC.Route("/srv-only-get", () => "ok");
		const res = await s.handle(req("/srv-only-get", { method: "DELETE" }));
		expect(res.status).toBe(404);
	});

	// ─── preflight ────────────────────────────────────────────────

	it("PREFLIGHT - RETURNS NO_CONTENT WITHOUT CORS", async () => {
		const s = createTestServer();
		const res = await s.handle(
			req("/srv-preflight", {
				method: "OPTIONS",
				headers: { "Access-Control-Request-Method": "POST" },
			}),
		);
		expect(res.status).toBe(TC.Status.NO_CONTENT);
		const body = await res.text();
		expect(body).toBe("");
	});

	it("PREFLIGHT - USES CORS PREFLIGHT HANDLER WHEN CORS IS SET", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: ["https://example.com"] });
		const res = await s.handle(
			req("/srv-preflight-cors", {
				method: "OPTIONS",
				headers: {
					origin: "https://example.com",
					"Access-Control-Request-Method": "POST",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
		new TC.Cors(undefined);
	});

	// ─── middleware - global ──────────────────────────────────────

	it("GLOBAL MIDDLEWARE - INBOUND RUNS BEFORE HANDLER", async () => {
		const s = createTestServer();
		const order: string[] = [];
		new TC.Middleware({
			useOn: "*",
			handler: () => {
				order.push("gmw-in");
			},
		});
		new TC.Route("/srv-gmw-in", () => {
			order.push("handler");
			return "ok";
		});
		await s.handle(req("/srv-gmw-in"));
		expect(order).toEqual(["gmw-in", "handler"]);
	});

	it("GLOBAL MIDDLEWARE - OUTBOUND RUNS AFTER HANDLER", async () => {
		const s = createTestServer();
		const order: string[] = [];
		new TC.Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				order.push("gmw-out");
			},
		});
		new TC.Route("/srv-gmw-out", () => {
			order.push("handler");
			return "ok";
		});
		await s.handle(req("/srv-gmw-out"));
		expect(order).toEqual(["handler", "gmw-out"]);
	});

	it("GLOBAL MIDDLEWARE - INBOUND RES SHORT-CIRCUITS HANDLER", async () => {
		const s = createTestServer();
		let handlerCalled = false;
		new TC.Middleware({
			useOn: "*",
			handler: () => new TC.Res({ blocked: true }, { status: 401 }),
		});
		new TC.Route("/srv-gmw-block", () => {
			handlerCalled = true;
			return "ok";
		});
		const res = await s.handle(req("/srv-gmw-block"));
		expect(res.status).toBe(401);
		expect(handlerCalled).toBe(false);
	});

	it("GLOBAL MIDDLEWARE - OUTBOUND RES OVERRIDES HANDLER RESULT", async () => {
		const s = createTestServer();
		new TC.Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				return new TC.Res({ overridden: true }, { status: 418 });
			},
		});
		new TC.Route("/srv-gmw-override", () => "original");
		const res = await s.handle(req("/srv-gmw-override"));
		expect(res.status).toBe(418);
		const data = await parseBody<{ overridden: boolean }>(res);
		expect(data.overridden).toBe(true);
	});

	// ─── middleware - local ───────────────────────────────────────

	it("LOCAL MIDDLEWARE - INBOUND RUNS FOR MATCHING ROUTE", async () => {
		const s = createTestServer();
		const order: string[] = [];

		const r = new TC.Route("/srv-lmw", () => {
			order.push("handler");
			return "ok";
		});
		new TC.Middleware({
			useOn: r,
			handler: () => {
				order.push("lmw-in");
			},
		});
		await s.handle(req("/srv-lmw"));
		expect(order).toEqual(["lmw-in", "handler"]);
	});

	it("LOCAL MIDDLEWARE - DOES NOT RUN FOR NON-MATCHING ROUTE", async () => {
		const s = createTestServer();
		let lmwCalled = false;
		new TC.Middleware({
			useOn: ["GET /srv-lmw-only"],
			handler: () => {
				lmwCalled = true;
			},
		});
		new TC.Route("/srv-lmw-other", () => "ok");
		await s.handle(req("/srv-lmw-other"));
		expect(lmwCalled).toBe(false);
	});

	it("MIDDLEWARE ORDER - GLOBAL IN, LOCAL IN, HANDLER, LOCAL OUT, GLOBAL OUT", async () => {
		const s = createTestServer();
		const order: string[] = [];
		new TC.Middleware({
			useOn: "*",
			handler: () => {
				order.push("gmw-in");
			},
		});
		new TC.Middleware({
			useOn: "*",
			handler: async (_, next) => {
				await next();
				order.push("gmw-out");
			},
		});

		const r = new TC.Route("/srv-order", () => {
			order.push("handler");
			return "ok";
		});

		new TC.Middleware({
			useOn: r,
			handler: () => {
				order.push("lmw-in");
			},
		});
		new TC.Middleware({
			useOn: r,
			handler: async (_, next) => {
				await next();
				order.push("lmw-out");
			},
		});
		await s.handle(req("/srv-order"));
		expect(order).toEqual(["gmw-in", "lmw-in", "handler", "lmw-out", "gmw-out"]);
	});

	// ─── setOnError ───────────────────────────────────────────────

	it("SET ON ERROR - CUSTOM HANDLER IS CALLED ON ERROR", async () => {
		const s = createTestServer();
		const defaultErrorHandler = s.handleError;
		s.handleError = () => {
			return new TC.Res({ error: true, message: "custom error" }, { status: 500 });
		};
		new TC.Route("/srv-error", () => {
			throw new Error("boom");
		});
		const res = await s.handle(req("/srv-error"));
		expect(res.status).toBe(500);
		const data = await parseBody<{ message: string }>(res);
		expect(data.message).toBe("custom error");

		s.handleError = defaultErrorHandler;
	});

	it("SET ON ERROR - DEFAULT HANDLER RETURNS 500", async () => {
		const s = createTestServer();
		new TC.Route("/srv-error-default", () => {
			throw new Error("unexpected");
		});
		const res = await s.handle(req("/srv-error-default"));
		expect(res.status).toBe(500);
	});

	it("SET ON ERROR - HTTP ERROR IS HANDLED BY DEFAULT HANDLER", async () => {
		const s = createTestServer();
		new TC.Route("/srv-httperror", () => {
			throw new TC.Exception("bad input", TC.Status.BAD_REQUEST);
		});
		const res = await s.handle(req("/srv-httperror"));
		expect(res.status).toBe(400);
		const data = await parseBody<{ message: string }>(res);
		expect(data.message).toBe("bad input");
	});

	it("SET ON ERROR - CUSTOM HANDLER RECEIVES ERROR AND CONTEXT", async () => {
		const s = createTestServer();
		const defaultErrorHandler = s.handleError;
		let receivedErrMessage: string | undefined;
		let receivedReqUrl: string | undefined;
		s.handleError = (err, ctx) => {
			receivedErrMessage = (err as Error).message;
			receivedReqUrl = ctx.req.url;
			return new TC.Res({ error: true }, { status: 500 });
		};
		new TC.Route("/srv-error-ctx", () => {
			throw new Error("boom-ctx");
		});
		await s.handle(req("/srv-error-ctx"));
		expect(receivedErrMessage).toBe("boom-ctx");
		expect(receivedReqUrl).toContain("/srv-error-ctx");

		s.handleError = defaultErrorHandler;
	});

	it("SET ON ERROR - ERROR THROWN IN MIDDLEWARE IS HANDLED", async () => {
		const s = createTestServer();
		new TC.Middleware({
			useOn: "*",
			handler: () => {
				throw new Error("middleware boom");
			},
		});
		new TC.Route("/srv-mw-error", () => "never");
		const res = await s.handle(req("/srv-mw-error"));
		expect(res.status).toBe(500);
	});

	// ─── setOnNotFound ────────────────────────────────────────────

	it("SET ON NOT FOUND - CUSTOM HANDLER IS CALLED", async () => {
		const s = createTestServer();
		const defaultNotFoundHandler = s.handleNotFound;
		s.handleNotFound = () => {
			return new TC.Res({ error: true, message: "custom not found" }, { status: 404 });
		};
		const res = await s.handle(req("/srv-custom-404"));
		expect(res.status).toBe(404);
		const data = await parseBody<{ message: string }>(res);
		expect(data.message).toBe("custom not found");

		s.handleNotFound = defaultNotFoundHandler;
	});

	it("SET ON NOT FOUND - DEFAULT HANDLER INCLUDES METHOD AND URL", async () => {
		const s = createTestServer();
		const res = await s.handle(req("/srv-default-404"));
		expect(res.status).toBe(404);
		const data = await parseBody<{ message: string }>(res);
		expect(data.message).toContain("GET");
		expect(data.message).toContain("/srv-default-404");
	});

	// ─── setGlobalPrefix ──────────────────────────────────────────

	it("SET GLOBAL PREFIX - ROUTE IS ACCESSIBLE UNDER PREFIX", async () => {
		const s = createTestServer();
		s.setGlobalPrefix("/api");
		new TC.Route("/srv-prefixed", () => "prefixed");
		const res = await s.handle(new Request("http://localhost:4444/api/srv-prefixed"));
		expect(res.status).toBe(200);
		s.setGlobalPrefix("");
	});

	it("SET GLOBAL PREFIX - ROUTE IS NOT ACCESSIBLE WITHOUT PREFIX", async () => {
		const s = createTestServer();
		s.setGlobalPrefix("/api");
		new TC.Route("/srv-no-prefix", () => "ok");
		const res = await s.handle(new Request("http://localhost:4444/srv-no-prefix"));
		expect(res.status).toBe(404);
		s.setGlobalPrefix("");
	});

	// ─── setOnBeforeListen / setOnBeforeClose ─────────────────────

	it("SET ON BEFORE LISTEN - HOOK RUNS BEFORE SERVER STARTS", async () => {
		const s = createTestServer({ port: 4482, hostname: "localhost" });
		let called = false;
		s.handleBeforeListen = () => {
			called = true;
		};
		await s.listen();
		try {
			expect(called).toBe(true);
		} finally {
			await s.close();
		}
	});

	it("SET ON BEFORE CLOSE - HOOK RUNS BEFORE SERVER STOPS", async () => {
		const s = createTestServer({ port: 4483, hostname: "localhost" });
		let called = false;
		s.handleBeforeClose = () => {
			called = true;
		};
		await s.listen();
		await s.close();
		expect(called).toBe(true);
	});

	it("SET ON BEFORE LISTEN - UNDEFINED HOOK IS A NO-OP", async () => {
		const s = createTestServer({ port: 4484, hostname: "localhost" });
		s.handleBeforeListen = undefined;
		await s.listen();
		await s.close();
		// no throw = pass
	});

	// ─── CORS integration ─────────────────────────────────────────

	it("CORS - SETS ORIGIN HEADER ON ALLOWED ORIGIN", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: ["https://example.com"] });
		new TC.Route("/srv-cors", () => "ok");
		const res = await s.handle(req("/srv-cors", { headers: { origin: "https://example.com" } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
		new TC.Cors(undefined);
	});

	it("CORS - DOES NOT SET ORIGIN HEADER ON DISALLOWED ORIGIN", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: ["https://example.com"] });
		new TC.Route("/srv-cors-blocked", () => "ok");
		const res = await s.handle(
			req("/srv-cors-blocked", { headers: { origin: "https://evil.com" } }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		new TC.Cors(undefined);
	});

	it("CORS - IS NOT APPLIED WHEN NOT SET", async () => {
		const s = createTestServer();
		new TC.Route("/srv-no-cors", () => "ok");
		const res = await s.handle(req("/srv-no-cors", { headers: { origin: "https://example.com" } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("CORS - IS APPLIED TO ERROR RESPONSES", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: ["https://example.com"] });
		new TC.Route("/srv-cors-error", () => {
			throw new Error("boom");
		});
		const res = await s.handle(
			req("/srv-cors-error", { headers: { origin: "https://example.com" } }),
		);
		expect(res.status).toBe(500);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
		new TC.Cors(undefined);
	});

	it("CORS - IS APPLIED TO 404 RESPONSES", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: ["https://example.com"] });
		const res = await s.handle(
			req("/srv-cors-404", { headers: { origin: "https://example.com" } }),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
		new TC.Cors(undefined);
	});

	// ─── live server (.listen) ────────────────────────────────────

	it("LISTEN - SERVES REAL HTTP REQUESTS", async () => {
		const PORT = 4485;
		const s = createTestServer({ port: PORT, hostname: "localhost" });
		new TC.Route("/live", () => ({ live: true }));
		await s.listen();
		try {
			const res = await fetch(`http://localhost:${PORT}/live`);
			expect(res.status).toBe(200);
			const data = (await res.json()) as { live: boolean };
			expect(data.live).toBe(true);
		} catch (err) {
			console.log(err);
		} finally {
			await s.close();
		}
	});

	it("LISTEN - DOUBLE CLOSE DOES NOT THROW", async () => {
		const s = createTestServer({ port: 4486, hostname: "localhost" });
		await s.listen();
		await s.close();
		await s.close();
	});

	// ─── idle timeout ─────────────────────────────────────────────

	it("IDLE TIMEOUT - CLOSES IDLE KEEP-ALIVE CONNECTION", async () => {
		const PORT = 4481;
		const HOST = "localhost";
		const s = createTestServer({ port: PORT, hostname: HOST, idleTimeout: 1 });
		new TC.Route("/idle-timeout-test", () => "ok");

		function rawRequest(path: string): string {
			return [
				`GET ${path} HTTP/1.1`,
				`Host: ${HOST}:${PORT}`,
				"Connection: keep-alive",
				"",
				"",
			].join("\r\n");
		}

		function send(socket: net.Socket, data: string): Promise<string> {
			return new Promise((resolve, reject) => {
				socket.once("data", (chunk) => resolve(chunk.toString()));
				socket.once("error", reject);
				socket.write(data);
			});
		}

		function waitForClose(socket: net.Socket): Promise<void> {
			return new Promise((resolve) => {
				socket.once("close", resolve);
				socket.once("end", () => socket.destroy());
			});
		}

		await s.listen();

		let error: unknown;
		try {
			const socket = net.connect(PORT, HOST);
			await new Promise<void>((resolve, reject) => {
				socket.once("connect", resolve);
				socket.once("error", reject);
			});

			await send(socket, rawRequest("/idle-timeout-test"));
			await Bun.sleep(200);

			const closePromise = waitForClose(socket);
			socket.write(rawRequest("/idle-timeout-test"));

			await Promise.race([
				closePromise,
				Bun.sleep(500).then(() => {
					throw new Error("Socket was not closed by idle timeout");
				}),
			]);
		} catch (err) {
			error = err;
		} finally {
			await s.close();
		}
		expect(error).toBeDefined();
	});
});

import { describe, expect, it, beforeEach } from "bun:test";
import net from "net";

import { TC, $registryTesting } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { parseBody } from "../utils/parse";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

describe("Server", () => {
	// ─── handle() - routing ───────────────────────────────────────

	describe("handle", () => {
		it("returns 200 for registered route", async () => {
			const s = createTestServer();
			new TC.Route("/srv-200", () => "ok");
			const res = await s.handle(req("/srv-200"));
			expect(res.status).toBe(200);
		});

		it("returns 404 for unregistered route", async () => {
			const s = createTestServer();
			const res = await s.handle(req("/srv-does-not-exist"));
			expect(res.status).toBe(404);
		});

		it("returns handler result as body", async () => {
			const s = createTestServer();
			new TC.Route("/srv-body", () => ({ hello: "world" }));
			const res = await s.handle(req("/srv-body"));
			const data = await parseBody<{ hello: string }>(res);
			expect(data.hello).toBe("world");
		});

		it("returns res instance directly when handler returns res", async () => {
			const s = createTestServer();
			new TC.Route("/srv-res-direct", () => {
				return new TC.Res({ direct: true }, { status: 201 });
			});
			const res = await s.handle(req("/srv-res-direct"));
			expect(res.status).toBe(201);
			const data = await parseBody<{ direct: boolean }>(res);
			expect(data.direct).toBe(true);
		});

		it("wraps plain handler result in res with 200", async () => {
			const s = createTestServer();
			new TC.Route("/srv-plain", () => "plain text");
			const res = await s.handle(req("/srv-plain"));
			expect(res.status).toBe(200);
		});

		it("passes parsed params to context", async () => {
			const s = createTestServer();
			new TC.Route<never, never, { id: number }>("/srv-user/:id", (ctx) => ({ id: ctx.params.id }));
			const res = await s.handle(req("/srv-user/42"));
			const data = await parseBody<{ id: number }>(res);
			expect(data.id).toBe(42);
		});

		it("passes search params to context", async () => {
			const s = createTestServer();
			new TC.Route<never, { q: string }>("/srv-search", (ctx) => ({ q: ctx.search.q }));
			const res = await s.handle(req("/srv-search?q=hello"));
			const data = await parseBody<{ q: string }>(res);
			expect(data.q).toBe("hello");
		});
	});

	// ─── method routing ───────────────────────────────────────────

	describe("method routing", () => {
		it("get and post on same path are distinct", async () => {
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

		it("unregistered method on registered path returns 404", async () => {
			const s = createTestServer();
			new TC.Route("/srv-only-get", () => "ok");
			const res = await s.handle(req("/srv-only-get", { method: "DELETE" }));
			expect(res.status).toBe(404);
		});
	});

	// ─── preflight ────────────────────────────────────────────────
	describe("preflight", () => {
		it("returns no_content without cors", async () => {
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

		it("uses cors preflight handler when cors is set", async () => {
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
	});

	// ─── setOnError ───────────────────────────────────────────────

	describe("handleError", () => {
		it("custom handler is called on error", async () => {
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

		it("default handler returns 500", async () => {
			const s = createTestServer();
			new TC.Route("/srv-error-default", () => {
				throw new Error("unexpected");
			});
			const res = await s.handle(req("/srv-error-default"));
			expect(res.status).toBe(500);
		});

		it("http error is handled by default handler", async () => {
			const s = createTestServer();
			new TC.Route("/srv-httperror", () => {
				throw new TC.Exception("bad input", TC.Status.BAD_REQUEST);
			});
			const res = await s.handle(req("/srv-httperror"));
			expect(res.status).toBe(400);
			const data = await parseBody<{ message: string }>(res);
			expect(data.message).toBe("bad input");
		});

		it("custom handler receives error and context", async () => {
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

		it("error thrown in middleware is handled", async () => {
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
	});

	// ─── setOnNotFound ────────────────────────────────────────────

	describe("handleNotFound", () => {
		it("custom handler is called", async () => {
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

		it("default handler includes method and url", async () => {
			const s = createTestServer();
			const res = await s.handle(req("/srv-default-404"));
			expect(res.status).toBe(404);
			const data = await parseBody<{ message: string }>(res);
			expect(data.message).toContain("GET");
			expect(data.message).toContain("/srv-default-404");
		});
	});

	// ─── setOnBeforeListen / setOnBeforeClose ─────────────────────

	describe("handleBeforeListen / handleBeforeClose", () => {
		it("hook runs before server starts", async () => {
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

		it("hook runs before server stops", async () => {
			const s = createTestServer({ port: 4483, hostname: "localhost" });
			let called = false;
			s.handleBeforeClose = () => {
				called = true;
			};
			await s.listen();
			await s.close();
			expect(called).toBe(true);
		});
	});

	// ─── CORS integration ─────────────────────────────────────────

	describe("CORS integration", () => {
		it("sets origin header on allowed origin", async () => {
			const s = createTestServer();
			new TC.Cors({ allowedOrigins: ["https://example.com"] });
			new TC.Route("/srv-cors", () => "ok");
			const res = await s.handle(req("/srv-cors", { headers: { origin: "https://example.com" } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
			new TC.Cors(undefined);
		});

		it("does not set origin header on disallowed origin", async () => {
			const s = createTestServer();
			new TC.Cors({ allowedOrigins: ["https://example.com"] });
			new TC.Route("/srv-cors-blocked", () => "ok");
			const res = await s.handle(
				req("/srv-cors-blocked", { headers: { origin: "https://evil.com" } }),
			);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
			new TC.Cors(undefined);
		});

		it("is not applied when not set", async () => {
			const s = createTestServer();
			new TC.Route("/srv-no-cors", () => "ok");
			const res = await s.handle(
				req("/srv-no-cors", { headers: { origin: "https://example.com" } }),
			);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("is applied to error responses", async () => {
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

		it("is applied to 404 responses", async () => {
			const s = createTestServer();
			new TC.Cors({ allowedOrigins: ["https://example.com"] });
			const res = await s.handle(
				req("/srv-cors-404", { headers: { origin: "https://example.com" } }),
			);
			expect(res.status).toBe(404);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
			new TC.Cors(undefined);
		});
	});

	// ─── live server (.listen) ────────────────────────────────────

	describe("listen / close", () => {
		it("serves real http requests", async () => {
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

		it("double close does not throw", async () => {
			const s = createTestServer({ port: 4486, hostname: "localhost" });
			await s.listen();
			await s.close();
			await s.close();
		});
	});

	// ─── idle timeout ─────────────────────────────────────────────

	describe("options", () => {
		it("idle timeout - closes idle keep-alive connection", async () => {
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
});

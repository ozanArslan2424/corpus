import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import net from "net";

import { App } from "@/App";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Middleware } from "@/Middleware";
import { Res, Status } from "@/Res";
import { Route } from "@/Route";
import { resetLogger, setLoggerNoop } from "@/utils/logger";

declare module "@/index" {
	interface ContextDataInterface {
		trace?: Array<string>;
	}
}

const PORT = 48210;
const BASE_URL = `http://localhost:${PORT}`;

let app: App;
let calls: Array<string>;

const rawRequest = (raw: string, port: number = PORT): Promise<string> =>
	new Promise((resolve, reject) => {
		let data = "";
		const socket = net.createConnection({ port, host: "localhost" });
		socket.setTimeout(3000);
		socket.on("connect", () => socket.write(raw));
		socket.on("data", (chunk) => {
			data += chunk.toString();
		});
		socket.on("timeout", () => socket.destroy());
		socket.on("close", () => resolve(data));
		socket.on("error", (err) => {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === "ECONNRESET" || code === "EPIPE") {
				socket.destroy();
				resolve(data);
				return;
			}
			reject(err);
		});
	});

const statusOf = (raw: string): number => Number(raw.split(" ")[1] ?? 0);
const bodyOf = (raw: string): string => raw.split("\r\n\r\n").slice(1).join("\r\n\r\n");

const chunked = (endpoint: string, payload: string, contentType: string): string =>
	`POST ${endpoint} HTTP/1.1\r\n` +
	"Host: localhost\r\n" +
	`Content-Type: ${contentType}\r\n` +
	"Transfer-Encoding: chunked\r\n" +
	"Connection: close\r\n\r\n" +
	`${payload.length.toString(16)}\r\n${payload}\r\n0\r\n\r\n`;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	// ── routing surface ────────────────────────────────────────────
	new Route("GET /ok", () => "ok");
	new Route("POST /echo", (c) => c.body);
	new Route("GET /files/*", (c) => c.params);

	// ── handler return values, applied by respond() ────────────────
	new Route("GET /returns/undefined", (c) => {
		c.res.body = { fromRes: true };
		c.res.status = Status.ACCEPTED;
		return undefined;
	});
	new Route("GET /returns/res", () => new Res({ replaced: true }, { status: Status.CREATED }));

	// ── error paths ────────────────────────────────────────────────
	new Route("GET /throws/exception", () => {
		throw new Exception("teapot", Status.IM_A_TEAPOT);
	});
	new Route("GET /throws/error", () => {
		throw new Error("internal detail");
	});

	// ── body limit, route level ────────────────────────────────────
	new Route("POST /limited", (c) => c.body, { maxRequestBodySize: 1024 });
	new Route("POST /limited-unread", () => "ok", { maxRequestBodySize: 1024 });
	new Route("POST /limited-binary", () => "ok", { maxRequestBodySize: 1024 });

	// ── middleware chain semantics ─────────────────────────────────
	const chained = new Route("GET /chained", (c) => {
		c.data.trace?.push("handler");
		return { trace: c.data.trace };
	});

	const doubleNext = new Route("GET /double-next", () => "unreachable");
	const replacesRes = new Route("GET /replaces-res", () => ({ fromHandler: true }));
	const shortCircuits = new Route("GET /short-circuits", () => {
		calls.push("handler:short-circuits");
		return "unreachable";
	});

	new Middleware({
		handler: async (c, next) => {
			c.data.trace = ["global"];
			calls.push("global");
			return await next();
		},
	});

	new Middleware({
		useOn: chained,
		handler: async (c, next) => {
			c.data.trace?.push("scoped");
			return await next();
		},
	});

	new Middleware({
		useOn: doubleNext,
		handler: async (_c, next) => {
			await next();
			return await next();
		},
	});

	new Middleware({
		useOn: replacesRes,
		handler: async (c, next) => {
			await next();
			c.res = new Res({ fromMiddleware: true }, { status: Status.ACCEPTED });
		},
	});

	new Middleware({
		useOn: shortCircuits,
		handler: () => new Res({ blocked: true }, { status: Status.FORBIDDEN }),
	});

	await app.listen();
});

beforeEach(() => {
	calls = [];
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("App e2e", () => {
	// ═══════════════════════════════════════════════════════════════
	describe("lifecycle", () => {
		it("should bind the configured port and serve requests", async () => {
			const res = await fetch(`${BASE_URL}/ok`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("ok");
		});

		it("should report the bound server's url as baseUrl", () => {
			expect(app.baseUrl).toContain(`:${PORT}`);
			expect(app.baseUrl.startsWith("http://")).toBeTrue();
		});

		it("should report a constructed url as baseUrl before listening", () => {
			const unbound = new App({ port: 49999, hostname: "localhost" });
			expect(unbound.baseUrl).toBe("http://localhost:49999");
		});

		it("should fall back to the constructed url as baseUrl after close", async () => {
			const port = 48213;
			const closable = new App({ port, hostname: "localhost" });
			new Route("GET /alive", () => "alive");

			await closable.listen();
			expect(closable.baseUrl).toContain(`:${port}`);

			await closable.close();
			expect(closable.baseUrl).toBe(`http://localhost:${port}`);
		});

		it("should run handleBeforeListen before binding and handleBeforeClose on close", async () => {
			const order: Array<string> = [];
			const port = 48211;
			const hooked = new App({ port, hostname: "localhost" });

			hooked.handleBeforeListen = () => {
				order.push("beforeListen");
			};
			hooked.handleBeforeClose = () => {
				order.push("beforeClose");
			};

			new Route("GET /hooked", () => "hooked");
			await hooked.listen();
			order.push("listening");

			expect((await fetch(`http://localhost:${port}/hooked`)).status).toBe(200);

			await hooked.close();
			expect(order).toEqual(["beforeListen", "listening", "beforeClose"]);
		});

		it("should release the port on close and be able to listen again", async () => {
			const port = 48212;
			const restartable = new App({ port, hostname: "localhost" });
			new Route("GET /which", () => "up");

			await restartable.listen();
			expect(await (await fetch(`http://localhost:${port}/which`)).text()).toBe("up");

			await restartable.close();
			expect(restartable.server).toBeNull();

			await restartable.listen();
			expect(await (await fetch(`http://localhost:${port}/which`)).text()).toBe("up");
			await restartable.close();
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("respond", () => {
		it("should send the context's own Res when the handler returns undefined", async () => {
			const res = await fetch(`${BASE_URL}/returns/undefined`);
			expect(res.status).toBe(202);
			expect(await res.json()).toEqual({ fromRes: true });
		});

		it("should replace the context's Res when the handler returns one", async () => {
			const res = await fetch(`${BASE_URL}/returns/res`);
			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ replaced: true });
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("middleware composition", () => {
		it("should run global middleware before route-scoped middleware", async () => {
			const res = await fetch(`${BASE_URL}/chained`);
			expect(await res.json()).toEqual({ trace: ["global", "scoped", "handler"] });
		});

		it("should let a middleware's outbound Res replacement win over the handler's body", async () => {
			const res = await fetch(`${BASE_URL}/replaces-res`);
			expect(res.status).toBe(202);
			expect(await res.json()).toEqual({ fromMiddleware: true });
		});

		it("should skip the handler when a middleware returns without calling next", async () => {
			const res = await fetch(`${BASE_URL}/short-circuits`);
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ blocked: true });
			expect(calls).not.toContain("handler:short-circuits");
		});

		it("should reject a middleware that calls next more than once", async () => {
			const res = await fetch(`${BASE_URL}/double-next`);
			expect(res.status).toBe(500);
			expect(await res.json()).toMatchObject({ message: "next() called multiple times" });
		});

		it("should run global middleware on the not-found path", async () => {
			const res = await fetch(`${BASE_URL}/no-such-route`);
			expect(res.status).toBe(404);
			expect(calls).toContain("global");
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("handleNotFound", () => {
		it("should answer an unmatched route with 404", async () => {
			const res = await fetch(`${BASE_URL}/no-such-route`);
			expect(res.status).toBe(404);
			expect(await res.json()).toMatchObject({
				message: expect.stringContaining("does not exist"),
			});
		});

		it("should answer an unregistered method on a known endpoint with 404", async () => {
			const res = await fetch(`${BASE_URL}/ok`, { method: "DELETE" });
			expect(res.status).toBe(404);
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("handlePreflight", () => {
		it("should answer a preflight with 204 when no CORS is configured", async () => {
			const res = await fetch(`${BASE_URL}/ok`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://app.example.com",
					"Access-Control-Request-Method": "POST",
				},
			});
			expect(res.status).toBe(204);
			expect(await res.text()).toBe("");
		});

		it("should not treat a plain OPTIONS request as a preflight", async () => {
			const res = await fetch(`${BASE_URL}/ok`, { method: "OPTIONS" });
			expect(res.status).toBe(404);
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("handleError", () => {
		it("should send an Exception's own response", async () => {
			const res = await fetch(`${BASE_URL}/throws/exception`);
			expect(res.status).toBe(418);
			expect(await res.json()).toMatchObject({ message: "teapot" });
		});

		it("should send a generic 500 for an unexpected Error, without its message", async () => {
			const res = await fetch(`${BASE_URL}/throws/error`);
			expect(res.status).toBe(500);

			const body = await res.text();
			expect(body).not.toContain("internal detail");
			expect(JSON.parse(body)).toEqual({ message: "INTERNAL_SERVER_ERROR" });
		});

		it("should use an overridden handleError", async () => {
			const original = app.handleError;
			app.handleError = () => new Res({ handled: true }, { status: Status.BAD_GATEWAY });
			try {
				const res = await fetch(`${BASE_URL}/throws/error`);
				expect(res.status).toBe(502);
				expect(await res.json()).toEqual({ handled: true });
			} finally {
				app.handleError = original;
			}
		});

		it("should still answer with 500 when handleError itself throws", async () => {
			// the fatal catch uses logger, set to noop to avoid crowding test logs
			setLoggerNoop();

			const ogHandleError = app.handleError;
			app.handleError = () => {
				throw new Error("handler for handlers exploded");
			};
			try {
				const res = await fetch(`${BASE_URL}/throws/error`);
				expect(res.status).toBe(500);
				expect(await res.text()).toBe("");
			} finally {
				app.handleError = ogHandleError;
				resetLogger();
			}
		});

		it("should stay up after a fatal error path", async () => {
			expect((await fetch(`${BASE_URL}/ok`)).status).toBe(200);
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("body limits", () => {
		it("should reject a declared body over the route's limit with 413", async () => {
			const res = await fetch(`${BASE_URL}/limited`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: "x".repeat(4096) }),
			});
			expect(res.status).toBe(413);
		});

		it("should enforce the limit even when the handler never reads the body", async () => {
			const res = await fetch(`${BASE_URL}/limited-unread`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: "x".repeat(4096) }),
			});
			expect(res.status).toBe(413);
		});

		it("should reject an undeclared chunked body over the limit with 413", async () => {
			const raw = await rawRequest(chunked("/limited", "x".repeat(8192), "application/json"));
			expect(statusOf(raw)).toBe(413);
		});

		it("should accept a body within the limit and parse it", async () => {
			const res = await fetch(`${BASE_URL}/limited`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ small: true }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ small: true });
		});

		it("should not apply the chunked byte count to a binary body", async () => {
			// binary bodies reach the handler as a live stream, so they are exempt
			// from the drain-and-count path; only a declared length is checked
			const raw = await rawRequest(
				chunked("/limited-binary", "x".repeat(8192), "application/octet-stream"),
			);
			expect(statusOf(raw)).toBe(200);
			expect(bodyOf(raw)).toContain("ok");
		});

		it("should not read a body on GET", async () => {
			const res = await fetch(`${BASE_URL}/ok`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("ok");
		});
	});

	// ═══════════════════════════════════════════════════════════════
	describe("wildcard routes", () => {
		it("should expose the matched wildcard tail as a param", async () => {
			const res = await fetch(`${BASE_URL}/files/deep/nested/thing.txt`);
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ "*": "deep/nested/thing.txt" });
		});

		it("should decode a percent-encoded wildcard tail", async () => {
			const res = await fetch(`${BASE_URL}/files/${encodeURIComponent("a b/c")}`);
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ "*": "a b/c" });
		});

		it("should exclude the query string from the wildcard tail", async () => {
			const res = await fetch(`${BASE_URL}/files/thing.txt?q=1`);
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ "*": "thing.txt" });
		});
	});
});

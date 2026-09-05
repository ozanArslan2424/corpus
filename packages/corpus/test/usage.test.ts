import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { type } from "arktype";
import { z } from "zod";

import { C, Globals } from "@/index";

// The entrypoint calls initialize() on import, so a consumer never calls it
// themselves - that's what this file is standing in for. No initialize() here
// on purpose: if the entrypoint stops bootstrapping, these tests break.

declare module "@/index" {
	interface ContextDataInterface {
		requestId?: string;
	}
}

const PORT = 48200;
const BASE_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;

const JSON_HEADERS = { "content-type": "application/json" };

const INDEX_HTML = "<html><body>spa shell</body></html>";
const STATIC_HTML = "<html><body>static page</body></html>";
const REPORT_TXT = "quarterly report contents";
const ASSET_JS = "console.log('asset');";

let app: C.App;
let dir: string;
let calls: Array<string>;
let closeCallbacks: Array<() => void> = [];

const connect = (endpoint: string): Promise<{ ws: WebSocket; next: () => Promise<string> }> =>
	new Promise((resolve, reject) => {
		const ws = new WebSocket(`${WS_URL}${endpoint}`);
		const queue: Array<string> = [];
		let pending: ((message: string) => void) | null = null;

		ws.addEventListener("message", (event) => {
			const data = String(event.data);
			if (pending) {
				const resolvePending = pending;
				pending = null;
				resolvePending(data);
			} else {
				queue.push(data);
			}
		});

		const next = (): Promise<string> =>
			new Promise((resolveNext) => {
				const buffered = queue.shift();
				if (buffered !== undefined) resolveNext(buffered);
				else pending = resolveNext;
			});

		ws.onopen = () => resolve({ ws, next });
		ws.onerror = () => reject(new Error(`could not connect to ${endpoint}`));
	});

const closeAndWait = (ws: WebSocket): Promise<void> =>
	new Promise((resolve) => {
		ws.addEventListener("close", () => resolve(), { once: true });
		ws.close();
	});

beforeAll(async () => {
	Globals.set("apps", []);
	app = new C.App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-integration-"));
	fs.mkdirSync(path.join(dir, "assets"));
	fs.writeFileSync(path.join(dir, "index.html"), INDEX_HTML);
	fs.writeFileSync(path.join(dir, "page.html"), STATIC_HTML);
	fs.writeFileSync(path.join(dir, "report.txt"), REPORT_TXT);
	fs.writeFileSync(path.join(dir, "assets", "app-a1b2c3.js"), ASSET_JS);

	// ------------------------------------------------------------- 1. routing

	new C.Route("GET /users", () => ({ method: "GET" }));
	new C.Route("POST /users", () => ({ method: "POST" }));
	new C.Route("PUT /users", () => ({ method: "PUT" }));
	new C.Route("DELETE /users", () => ({ method: "DELETE" }));
	new C.Route({ method: C.Method.GET, endpoint: "/object-address" }, () => "object address");
	new C.Route("GET /users/:id/posts/:postId", (c) => ({ params: { ...(c.params as object) } }));
	new C.Route("GET /files/*", (c) => ({ pathname: c.url.pathname }));

	// -------------------------------------------------- 2 & 3. body / search

	new C.Route("POST /echo/body", (c) => ({ body: c.body }));
	new C.Route("GET /echo/search", (c) => ({ search: { ...(c.search as object) } }));
	new C.Route("POST /upload", async (c) => {
		const body = c.body as { title?: string; file?: File };
		return {
			title: body.title,
			filename: body.file?.name,
			contents: await body.file?.text(),
		};
	});

	// --------------------------------------------------------- 4. validation

	const zodBody = z.object({ name: z.string().min(1), age: z.coerce.number() });
	const zodParams = z.object({ id: z.coerce.number().int() });

	new C.Route<z.infer<typeof zodBody>, unknown, z.infer<typeof zodParams>>(
		"POST /zod/users/:id",
		(c) => ({ body: c.body, params: c.params }),
		{ body: zodBody, params: zodParams },
	);

	const arkBody = type({ name: "string", qty: "number" });
	const arkSearch = type({ "q?": "string" });

	new C.Route<typeof arkBody.infer, typeof arkSearch.infer>(
		"POST /ark/items",
		(c) => ({ body: c.body, search: c.search }),
		{ body: arkBody, search: arkSearch },
	);

	// ------------------------------------------------------- 5. file variants

	new C.StaticRoute("GET /static/page", path.join(dir, "page.html"));
	new C.FileRoute("GET /download", {
		filePath: path.join(dir, "report.txt"),
		disposition: "attachment",
	});
	new C.BundleRoute("/app/*", dir);

	// ---------------------------------------------------------- 6. controller

	const api = new C.Controller("/api");
	api.beforeEach = (c) => {
		calls.push(`controller:beforeEach:${c.url.pathname}`);
	};
	api.route("GET /health", () => {
		calls.push("controller:handler");
		return { ok: true };
	});
	api.fileRoute("GET /report", { filePath: path.join(dir, "report.txt") });
	api.websocketRoute("/ws", {
		onMessage: (ws, message) => {
			ws.send(`api:${message}`);
		},
	});

	// ---------------------------------------------------------- 7. middleware

	const guarded = new C.Route("GET /guarded", () => {
		calls.push("handler:guarded");
		return "unreachable";
	});

	new C.Middleware({
		handler: async (c, next) => {
			calls.push("global:before");
			c.data.requestId = "req-1";
			const result = await next();
			c.res.headers.setMany({ "X-Global": "yes" });
			calls.push("global:after");
			return result;
		},
	});

	new C.Middleware({
		useOn: guarded,
		handler: () => {
			calls.push("guard");
			return new C.Res({ error: "forbidden" }, { status: C.Status.FORBIDDEN });
		},
	});

	new C.Route("GET /data", (c) => ({ requestId: c.data.requestId }));

	// --------------------------------------------------------------- 9. cookies

	new C.Route("GET /cookies/read", (c) => ({
		session: c.req.cookies.get("session"),
		theme: c.req.cookies.get("theme"),
	}));

	new C.Route("GET /cookies/write", (c) => {
		c.res.cookies.set("session", "abc123", { httpOnly: true, path: "/", maxAge: 600 });
		c.res.cookies.set("theme", "dark", { path: "/" });
		return { ok: true };
	});

	// -------------------------------------------------------- 10. error handling

	new C.Route("GET /throws/exception", () => {
		throw new C.Exception("teapot", C.Status.IM_A_TEAPOT);
	});
	new C.Route("GET /throws/async", async () => {
		await Bun.sleep(5);
		throw new C.Exception("late teapot", C.Status.IM_A_TEAPOT);
	});
	new C.Route("GET /throws/error", () => {
		throw new Error("unexpected");
	});

	// ------------------------------------------------------------ 12. websocket

	new C.WebSocketRoute("/ws/echo", {
		onOpen: (ws) => {
			ws.send("welcome");
		},
		onMessage: (ws, message) => {
			ws.send(`echo:${message}`);
		},
		onClose: () => {
			calls.push("ws:close");
			closeCallbacks.shift()?.();
		},
	});

	// ----------------------------------------------------------------- 8. cors

	new C.Cors({
		allowedOrigins: ["https://app.example.com"],
		allowedMethods: ["GET", "POST", "PUT", "DELETE"],
		allowedHeaders: [C.HeaderKey.ContentType],
		exposedHeaders: [C.HeaderKey.ContentLength],
		maxAge: 600,
	});

	await app.listen();
});

beforeEach(() => {
	calls = [];
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("corpus integration", () => {
	describe("routing", () => {
		it("dispatches each method to its own handler", async () => {
			for (const method of ["GET", "POST", "PUT", "DELETE"]) {
				const res = await fetch(`${BASE_URL}/users`, { method });
				expect(res.status).toBe(200);
				expect(await res.json()).toEqual({ method });
			}
		});

		it("accepts both the string and object address forms", async () => {
			const shorthand = await fetch(`${BASE_URL}/users`);
			const object = await fetch(`${BASE_URL}/object-address`);
			expect(shorthand.status).toBe(200);
			expect(await object.text()).toBe("object address");
		});

		it("parses path params onto the context", async () => {
			const res = await fetch(`${BASE_URL}/users/42/posts/7`);
			expect(await res.json()).toEqual({ params: { id: 42, postId: 7 } });
		});

		it("matches a wildcard endpoint", async () => {
			const res = await fetch(`${BASE_URL}/files/deep/nested/thing.txt`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ pathname: "/files/deep/nested/thing.txt" });
		});

		it("404s an unmatched endpoint", async () => {
			const res = await fetch(`${BASE_URL}/nothing-here`);
			expect(res.status).toBe(404);
		});
	});

	describe("request bodies", () => {
		it("parses a JSON body", async () => {
			const res = await fetch(`${BASE_URL}/echo/body`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", tags: ["a", "b"] }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: { name: "Ozan", tags: ["a", "b"] } });
		});

		it("parses a urlencoded body", async () => {
			const res = await fetch(`${BASE_URL}/echo/body`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ name: "Ozan", role: "dev" }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: { name: "Ozan", role: "dev" } });
		});

		it("parses a multipart body with a file upload", async () => {
			const form = new FormData();
			form.append("title", "my report");
			form.append("file", new File([REPORT_TXT], "report.txt", { type: "text/plain" }));

			const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({
				title: "my report",
				filename: "report.txt",
				contents: REPORT_TXT,
			});
		});

		it("does not crash on a malformed JSON body", async () => {
			const res = await fetch(`${BASE_URL}/echo/body`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: "{not json",
			});
			expect(res.status).toBeGreaterThanOrEqual(400);
			expect(res.status).toBeLessThan(500);

			// the server is still up afterwards
			const after = await fetch(`${BASE_URL}/users`);
			expect(after.status).toBe(200);
		});
	});

	describe("search params", () => {
		it("parses the query string onto the context", async () => {
			const res = await fetch(`${BASE_URL}/echo/search?q=hello&page=2`);
			expect(await res.json()).toEqual({ search: { q: "hello", page: 2 } });
		});

		it("yields an empty search when there is no query string", async () => {
			const res = await fetch(`${BASE_URL}/echo/search`);
			expect(await res.json()).toEqual({ search: {} });
		});
	});

	describe("schema validation", () => {
		it("passes a valid zod payload through, transformed", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/42`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "Ozan", age: "30" }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ body: { name: "Ozan", age: 30 }, params: { id: 42 } });
		});

		it("rejects an invalid zod body with 422", async () => {
			const res = await fetch(`${BASE_URL}/zod/users/42`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "", age: 30 }),
			});
			expect(res.status).toBe(422);
			expect(await res.json()).toMatchObject({ message: expect.stringContaining("body") });
		});

		it("passes a valid arktype payload through", async () => {
			const res = await fetch(`${BASE_URL}/ark/items?q=widgets`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "widget", qty: 3 }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({
				body: { name: "widget", qty: 3 },
				search: { q: "widgets" },
			});
		});

		it("rejects an invalid arktype body with 422", async () => {
			const res = await fetch(`${BASE_URL}/ark/items`, {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ name: "widget", qty: "3" }),
			});
			expect(res.status).toBe(422);
		});
	});

	describe("file-backed routes", () => {
		it("serves a StaticRoute with its cache and length headers", async () => {
			const res = await fetch(`${BASE_URL}/static/page`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(STATIC_HTML);
			expect(res.headers.get("Content-Type")).toContain("text/html");
			expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(STATIC_HTML)));
			expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
		});

		it("streams a FileRoute with its disposition header", async () => {
			const res = await fetch(`${BASE_URL}/download`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(REPORT_TXT);
			expect(res.headers.get("Content-Disposition")).toContain("attachment");
			expect(res.headers.get("Content-Disposition")).toContain("report.txt");
		});

		it("serves the bundle index and falls back to it for client routes", async () => {
			const root = await fetch(`${BASE_URL}/app/`);
			expect(await root.text()).toBe(INDEX_HTML);

			const clientRoute = await fetch(`${BASE_URL}/app/dashboard/settings`);
			expect(clientRoute.status).toBe(200);
			expect(await clientRoute.text()).toBe(INDEX_HTML);
		});

		it("serves hashed bundle assets with an immutable cache policy", async () => {
			const res = await fetch(`${BASE_URL}/app/assets/app-a1b2c3.js`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(ASSET_JS);
			expect(res.headers.get("Cache-Control")).toContain("immutable");
		});
	});

	describe("controller", () => {
		it("prefixes dynamic, file and websocket routes alike", async () => {
			const health = await fetch(`${BASE_URL}/api/health`);
			expect(await health.json()).toEqual({ ok: true });

			const report = await fetch(`${BASE_URL}/api/report`);
			expect(await report.text()).toBe(REPORT_TXT);

			const { ws, next } = await connect("/api/ws");
			ws.send("hi");
			expect(await next()).toBe("api:hi");
			await closeAndWait(ws);
		});

		it("runs beforeEach ahead of the handler", async () => {
			await fetch(`${BASE_URL}/api/health`);
			expect(calls).toEqual([
				"global:before",
				"controller:beforeEach:/api/health",
				"controller:handler",
				"global:after",
			]);
		});
	});

	describe("middleware", () => {
		it("wraps every route and can mutate the response on the way out", async () => {
			const res = await fetch(`${BASE_URL}/users`);
			expect(res.headers.get("X-Global")).toBe("yes");
			expect(calls).toEqual(["global:before", "global:after"]);
		});

		it("hands context data down to the handler", async () => {
			const res = await fetch(`${BASE_URL}/data`);
			expect(await res.json()).toEqual({ requestId: "req-1" });
		});

		it("short-circuits the handler when a scoped middleware does not call next", async () => {
			const res = await fetch(`${BASE_URL}/guarded`);
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ error: "forbidden" });
			expect(calls).toEqual(["global:before", "guard", "global:after"]);
		});
	});

	describe("cors", () => {
		it("answers a preflight with the negotiated policy", async () => {
			const res = await fetch(`${BASE_URL}/users`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://app.example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "Content-Type",
				},
			});
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
			expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
			expect(res.headers.get("Access-Control-Max-Age")).toBe("600");
		});

		it("applies the policy to a real cross-origin request", async () => {
			const res = await fetch(`${BASE_URL}/users`, {
				headers: { Origin: "https://app.example.com" },
			});
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
			expect(res.headers.get("Access-Control-Expose-Headers")).toContain("Content-Length");
		});

		it("does not allow an origin outside the allowlist", async () => {
			const res = await fetch(`${BASE_URL}/users`, {
				headers: { Origin: "https://evil.example.com" },
			});
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});
	});

	describe("cookies", () => {
		it("reads cookies off the incoming request", async () => {
			const res = await fetch(`${BASE_URL}/cookies/read`, {
				headers: { Cookie: "session=abc123; theme=dark" },
			});
			expect(await res.json()).toEqual({ session: "abc123", theme: "dark" });
		});

		it("sends each response cookie as its own Set-Cookie header", async () => {
			const res = await fetch(`${BASE_URL}/cookies/write`);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);

			const parsed = C.Cookies.fromSetCookieHeaders(setCookieHeaders);
			expect(parsed.get("session")).toBe("abc123");
			expect(parsed.get("theme")).toBe("dark");

			const session = setCookieHeaders.find((header) => header.startsWith("session="));
			expect(session).toContain("HttpOnly");
			expect(session).toContain("Max-Age=600");
		});
	});

	describe("error handling", () => {
		it("turns a thrown Exception into its status and body", async () => {
			const res = await fetch(`${BASE_URL}/throws/exception`);
			expect(res.status).toBe(418);
			expect(await res.json()).toMatchObject({ message: "teapot" });
		});

		it("catches an Exception thrown asynchronously", async () => {
			const res = await fetch(`${BASE_URL}/throws/async`);
			expect(res.status).toBe(418);
			expect(await res.json()).toMatchObject({ message: "late teapot" });
		});

		it("turns an unexpected Error into a 500", async () => {
			const res = await fetch(`${BASE_URL}/throws/error`);
			expect(res.status).toBe(500);
		});

		it("respects a custom handleError override", async () => {
			const original = app.handleError;
			app.handleError = () => new C.Res({ handled: true }, { status: C.Status.BAD_GATEWAY });
			try {
				const res = await fetch(`${BASE_URL}/throws/error`);
				expect(res.status).toBe(502);
				expect(await res.json()).toEqual({ handled: true });
			} finally {
				app.handleError = original;
			}
		});
	});

	describe("websockets", () => {
		it("upgrades a connection and round-trips messages", async () => {
			const { ws, next } = await connect("/ws/echo");
			expect(await next()).toBe("welcome");

			ws.send("one");
			expect(await next()).toBe("echo:one");

			await closeAndWait(ws);
		});

		it("keeps concurrent sockets independent", async () => {
			const [a, b] = await Promise.all([connect("/ws/echo"), connect("/ws/echo")]);
			expect(await a.next()).toBe("welcome");
			expect(await b.next()).toBe("welcome");

			a.ws.send("from-a");
			b.ws.send("from-b");
			expect(await a.next()).toBe("echo:from-a");
			expect(await b.next()).toBe("echo:from-b");

			await Promise.all([closeAndWait(a.ws), closeAndWait(b.ws)]);
		});
	});

	describe("app lifecycle", () => {
		it("releases the port on close so it can be bound again", async () => {
			const port = 48201;
			const first = new C.App({ port, hostname: "localhost" });
			new C.Route("GET /alive", () => "first");
			await first.listen();
			expect(await (await fetch(`http://localhost:${port}/alive`)).text()).toBe("first");
			await first.close();

			const second = new C.App({ port, hostname: "localhost" });
			new C.Route("GET /alive", () => "second");
			await second.listen();
			expect(await (await fetch(`http://localhost:${port}/alive`)).text()).toBe("second");
			await second.close();
		});

		it("registers new routes on the nearest app, not earlier ones", async () => {
			const port = 48202;
			const other = new C.App({ port, hostname: "localhost" });
			new C.Route("GET /only-on-other", () => "other app");
			await other.listen();

			try {
				const onOther = await fetch(`http://localhost:${port}/only-on-other`);
				expect(await onOther.text()).toBe("other app");

				const onMain = await fetch(`${BASE_URL}/only-on-other`);
				expect(onMain.status).toBe(404);
			} finally {
				await other.close();
			}
		});
	});
});

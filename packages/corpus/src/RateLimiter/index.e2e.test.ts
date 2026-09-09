import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Middleware } from "@/Middleware";
import { RateLimiter } from "@/RateLimiter";
import { BundleRoute } from "@/RouteBase/BundleRoute";
import { FileRoute } from "@/RouteBase/FileRoute";
import { Route } from "@/RouteBase/Route";
import { StaticRoute } from "@/RouteBase/StaticRoute";
import { WebSocketRoute } from "@/RouteBase/WebSocketRoute";

const PORT = 48173;
const BASE_URL = `http://localhost:${PORT}`;

let dir: string;
let app: App;

beforeAll(async () => {
	initialize();
	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "rate-limiter-e2e-"));
	fs.writeFileSync(path.join(dir, "logo.txt"), "static logo bytes");
	fs.writeFileSync(path.join(dir, "report.txt"), "downloadable report");
	fs.writeFileSync(path.join(dir, "index.html"), "<html>bundled</html>");

	// one of each route variant
	new Route("/ping", () => "pong");
	new StaticRoute("/logo.txt", path.join(dir, "logo.txt"));
	new FileRoute("/download", { filePath: path.join(dir, "report.txt"), disposition: "attachment" });
	new WebSocketRoute("/ws", {
		onMessage: (ws, message) => {
			ws.send(`echo:${message}`);
		},
	});
	new BundleRoute("/app/*", dir); // registered before the limiter, see note below

	// inbound: runs before the handler, tags the response on the way in
	new Middleware({
		useOn: "*",
		handler: (c, next) => {
			c.res.headers.append("X-Trace", "inbound");
			return next();
		},
	});

	// outbound: runs after the handler resolves, tags the response on the way out
	new Middleware({
		useOn: "*",
		handler: async (c, next) => {
			await next();
			c.res.headers.append("X-Trace", "outbound");
		},
	});

	// scoped to /ping specifically, snapshots route ids once at construction -
	// registered last so /ping already exists and the bundle route is excluded by variant
	new RateLimiter({
		limits: { authenticated: 999, ipBased: 3, fingerprint: 2 },
		windowMs: 300,
	});

	// routes don't get rate limiting if constructed after the limiter:
	new Route("/free", () => "ok");

	await app.listen();
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("RateLimiter e2e", () => {
	describe("route variants", () => {
		it("dynamic Route responds", async () => {
			const res = await fetch(`${BASE_URL}/ping`, { headers: { "user-agent": "route-client" } });
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("pong");
		});

		it("StaticRoute serves the pre-read file bytes", async () => {
			const res = await fetch(`${BASE_URL}/logo.txt`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("static logo bytes");
		});

		it("FileRoute streams the file with a content-disposition header", async () => {
			const res = await fetch(`${BASE_URL}/download`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("downloadable report");
			expect(res.headers.get("Content-Disposition")).toContain("attachment");
		});

		it("BundleRoute falls back to index.html for a client-side route", async () => {
			const res = await fetch(`${BASE_URL}/app/anything`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("<html>bundled</html>");
		});

		it("WebSocketRoute upgrades and echoes a message", async () => {
			const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
			try {
				await new Promise<void>((resolve, reject) => {
					ws.addEventListener("open", () => resolve());
					ws.addEventListener("error", () => reject(new Error("ws failed to open")));
				});

				const echoed = new Promise<string>((resolve) => {
					ws.addEventListener("message", (event) => resolve(event.data as string));
				});
				ws.send("hello");

				expect(await echoed).toBe("echo:hello");
			} finally {
				ws.close();
			}
		});
	});

	describe("middleware ordering", () => {
		it("runs inbound middleware before the handler and outbound middleware after it", async () => {
			const res = await fetch(`${BASE_URL}/ping`, { headers: { "user-agent": "trace-client" } });
			expect(res.headers.get("X-Trace")).toBe("inbound, outbound");
		});

		it("applies to non-rate-limited routes too, since useOn is global", async () => {
			const res = await fetch(`${BASE_URL}/free`);
			expect(res.headers.get("X-Trace")).toBe("inbound, outbound");
		});
	});

	describe("rate limiting", () => {
		it("allows a request under the fingerprint limit and reports remaining count", async () => {
			const res = await fetch(`${BASE_URL}/ping`, { headers: { "user-agent": "client-a" } });
			expect(res.status).toBe(200);
			expect(res.headers.get("RateLimit-Remaining")).toBe("1");
		});

		it("returns 429 once the fingerprint limit is exceeded", async () => {
			const headers = { "user-agent": "client-b" };
			await fetch(`${BASE_URL}/ping`, { headers });
			await fetch(`${BASE_URL}/ping`, { headers });
			const blocked = await fetch(`${BASE_URL}/ping`, { headers });
			expect(blocked.status).toBe(429);
			expect(blocked.headers.get("Retry-After")).not.toBeNull();
		});

		it("tracks separate IP-based clients independently", async () => {
			const resA = await fetch(`${BASE_URL}/ping`, {
				headers: { "x-forwarded-for": "203.0.113.11" },
			});
			const resB = await fetch(`${BASE_URL}/ping`, {
				headers: { "x-forwarded-for": "203.0.113.22" },
			});
			expect(resA.headers.get("RateLimit-Remaining")).toBe("2");
			expect(resB.headers.get("RateLimit-Remaining")).toBe("2");
		});

		it("does not rate-limit the bundle route, since it was excluded at construction time", async () => {
			const res = await fetch(`${BASE_URL}/app/`, { headers: { "user-agent": "bundle-client" } });
			expect(res.status).toBe(200);
			expect(res.headers.get("RateLimit-Limit")).toBeNull();
		});

		it("resets the limit after the configured window elapses", async () => {
			const headers = { "user-agent": "client-window" };
			await fetch(`${BASE_URL}/ping`, { headers });
			await fetch(`${BASE_URL}/ping`, { headers });
			const blocked = await fetch(`${BASE_URL}/ping`, { headers });
			expect(blocked.status).toBe(429);

			await Bun.sleep(350);

			const afterWindow = await fetch(`${BASE_URL}/ping`, { headers });
			expect(afterWindow.status).toBe(200);
			expect(afterWindow.headers.get("RateLimit-Remaining")).toBe("1");
		});
	});
});

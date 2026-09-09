import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Controller } from "@/Controller";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import type { BundleRoute } from "@/RouteBase/BundleRoute";
import type { FileRoute } from "@/RouteBase/FileRoute";
import type { Route } from "@/RouteBase/Route";
import type { StaticRoute } from "@/RouteBase/StaticRoute";
import type { WebSocketRoute } from "@/RouteBase/WebSocketRoute";

const PORT = 48183;
const BASE_URL = `http://localhost:${PORT}`;

const INDEX_HTML = "<html><body>bundle root</body></html>";
const STATIC_TXT = "static content";
const FILE_TXT = "downloadable content";

let dir: string;
let app: App;
let calls: Array<string>;

let route: Route;
let staticRoute: StaticRoute;
let fileRoute: FileRoute;
let bundleRoute: BundleRoute;
let websocketRoute: WebSocketRoute;
let api: Controller<"/api">;

const readMessage = (url: string, send: string): Promise<string> =>
	new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		ws.onopen = () => ws.send(send);
		ws.onmessage = (event) => {
			ws.close();
			resolve(String(event.data));
		};
		ws.onerror = () => reject(new Error("websocket failed"));
	});

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "controller-e2e-"));
	fs.writeFileSync(path.join(dir, "index.html"), INDEX_HTML);
	fs.writeFileSync(path.join(dir, "page.txt"), STATIC_TXT);
	fs.writeFileSync(path.join(dir, "report.txt"), FILE_TXT);

	api = new Controller("/api");
	api.beforeEach = (c) => {
		calls.push(`beforeEach:${c.url.pathname}`);
	};

	route = api.route("GET /ping", (c) => {
		calls.push("handler");
		return { pathname: c.url.pathname };
	});

	staticRoute = api.staticRoute("GET /page", path.join(dir, "page.txt"), (_c, content) => {
		calls.push("staticCallback");
		return `wrapped:${content}`;
	});

	fileRoute = api.fileRoute("GET /download", {
		filePath: path.join(dir, "report.txt"),
		disposition: "attachment",
	});

	bundleRoute = api.bundleRoute("/app/*", dir);

	websocketRoute = api.websocketRoute("/ws", {
		onMessage: (ws, message) => {
			ws.send(`echo:${message}`);
		},
	});

	// a controller with no prefix - endpoints must be registered unchanged
	const bare = new Controller();
	bare.route("GET /bare", () => "bare");

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

describe("Controller e2e", () => {
	describe("prefixing", () => {
		it("serves a dynamic route under the prefix", async () => {
			const res = await fetch(`${BASE_URL}/api/ping`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ pathname: "/api/ping" });
		});

		it("serves a static route under the prefix", async () => {
			const res = await fetch(`${BASE_URL}/api/page`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(`wrapped:${STATIC_TXT}`);
		});

		it("serves a file route under the prefix", async () => {
			const res = await fetch(`${BASE_URL}/api/download`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(FILE_TXT);
			expect(res.headers.get("Content-Disposition")).toContain("attachment");
		});

		it("serves a bundle route under the prefix", async () => {
			const res = await fetch(`${BASE_URL}/api/app/`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(INDEX_HTML);
		});

		it("upgrades a websocket route under the prefix", async () => {
			const message = await readMessage(`ws://localhost:${PORT}/api/ws`, "hello");
			expect(message).toBe("echo:hello");
		});

		it("does not serve prefixed routes at their unprefixed endpoint", async () => {
			const res = await fetch(`${BASE_URL}/ping`);
			expect(res.status).toBe(404);
		});

		it("registers endpoints unchanged when the controller has no prefix", async () => {
			const res = await fetch(`${BASE_URL}/bare`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("bare");
		});
	});

	describe("beforeEach", () => {
		it("runs before a dynamic route handler", async () => {
			await fetch(`${BASE_URL}/api/ping`);
			expect(calls).toEqual(["beforeEach:/api/ping", "handler"]);
		});

		it("runs before a static route callback", async () => {
			await fetch(`${BASE_URL}/api/page`);
			expect(calls).toEqual(["beforeEach:/api/page", "staticCallback"]);
		});

		it("does not run for file, bundle or websocket routes", async () => {
			await fetch(`${BASE_URL}/api/download`);
			await fetch(`${BASE_URL}/api/app/`);
			await readMessage(`ws://localhost:${PORT}/api/ws`, "hello");
			expect(calls).toEqual([]);
		});
	});

	describe("routeIds", () => {
		it("collects the id of every route registered through the controller", () => {
			expect(api.routeIds.size).toBe(5);
			expect([...api.routeIds]).toEqual([
				route.id,
				staticRoute.id,
				fileRoute.id,
				bundleRoute.id,
				websocketRoute.id,
			]);
		});
	});
});

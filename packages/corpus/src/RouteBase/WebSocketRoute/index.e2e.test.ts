import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Route } from "@/RouteBase/Route";
import { WebSocketRoute } from "@/RouteBase/WebSocketRoute";

const PORT = 48195;
const BASE_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;

let app: App;
let calls: Array<string>;
let closed: Promise<{ code: number; reason: string }>;
let resolveClosed: (value: { code: number; reason: string }) => void;

const connect = (path: string): Promise<WebSocket> =>
	new Promise((resolve, reject) => {
		const ws = new WebSocket(`${WS_URL}${path}`);
		ws.onopen = () => resolve(ws);
		ws.onerror = () => reject(new Error(`could not connect to ${path}`));
	});

const nextMessage = (ws: WebSocket): Promise<string> =>
	new Promise((resolve, reject) => {
		ws.addEventListener("message", (event) => resolve(String(event.data)), { once: true });
		ws.addEventListener("error", () => reject(new Error("socket errored")), { once: true });
	});

const closeAndWait = (ws: WebSocket, code?: number, reason?: string): Promise<void> =>
	new Promise((resolve) => {
		ws.addEventListener("close", () => resolve(), { once: true });
		ws.close(code, reason);
	});

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	new WebSocketRoute("/echo", {
		onOpen: (ws) => {
			calls.push("open");
			ws.send("welcome");
		},
		onMessage: (ws, message) => {
			calls.push(`message:${message}`);
			ws.send(`echo:${message}`);
		},
		onClose: (_ws, code, reason) => {
			calls.push("close");
			resolveClosed({ code: code ?? 0, reason: reason ?? "" });
		},
	});

	// message-only definition: onOpen and onClose are optional
	new WebSocketRoute("/minimal", {
		onMessage: (ws, message) => {
			ws.send(`minimal:${message}`);
		},
	});

	// binary frames arrive as a Buffer rather than a string
	new WebSocketRoute("/binary", {
		onMessage: (ws, message) => {
			calls.push(Buffer.isBuffer(message) ? "buffer" : "string");
			ws.send(message);
		},
	});

	new WebSocketRoute("/rooms/:id", {
		onMessage: (ws, message) => {
			ws.send(`room:${message}`);
		},
	});

	// a plain route on the same app, to prove the two dispatch independently
	new Route("GET /echo/http", () => "http handler");

	await app.listen();
});

beforeEach(() => {
	calls = [];
	closed = new Promise((resolve) => {
		resolveClosed = resolve;
	});
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("WebSocketRoute e2e", () => {
	it("upgrades a connection and fires onOpen", async () => {
		const ws = await connect("/echo");
		const welcome = await nextMessage(ws);
		expect(welcome).toBe("welcome");
		expect(calls).toContain("open");
		await closeAndWait(ws);
		await closed;
	});

	it("fires onMessage for each frame and can reply on the same socket", async () => {
		const ws = await connect("/echo");
		await nextMessage(ws); // welcome

		ws.send("one");
		expect(await nextMessage(ws)).toBe("echo:one");
		ws.send("two");
		expect(await nextMessage(ws)).toBe("echo:two");

		await closeAndWait(ws);
		await closed;
		expect(calls).toEqual(["open", "message:one", "message:two", "close"]);
	});

	it("fires onClose with the client's code and reason", async () => {
		const ws = await connect("/echo");
		await nextMessage(ws);
		await closeAndWait(ws, 4001, "done here");

		const { code, reason } = await closed;
		expect(code).toBe(4001);
		expect(reason).toBe("done here");
	});

	it("works with a definition that only provides onMessage", async () => {
		const ws = await connect("/minimal");
		ws.send("hi");
		expect(await nextMessage(ws)).toBe("minimal:hi");
		await closeAndWait(ws);
	});

	it("delivers binary frames as a Buffer", async () => {
		const ws = await connect("/binary");
		ws.binaryType = "arraybuffer";

		const sent = Uint8Array.from([1, 2, 3, 4]);
		ws.send(sent);

		const received = await new Promise<ArrayBuffer>((resolve) => {
			ws.addEventListener("message", (event) => resolve(event.data as ArrayBuffer), { once: true });
		});

		expect(new Uint8Array(received)).toEqual(sent);
		expect(calls).toEqual(["buffer"]);
		await closeAndWait(ws);
	});

	it("upgrades a parameterized endpoint", async () => {
		const ws = await connect("/rooms/42");
		ws.send("hello");
		expect(await nextMessage(ws)).toBe("room:hello");
		await closeAndWait(ws);
	});

	it("keeps concurrent connections independent", async () => {
		const [a, b] = await Promise.all([connect("/minimal"), connect("/minimal")]);

		a.send("from-a");
		b.send("from-b");

		expect(await nextMessage(a)).toBe("minimal:from-a");
		expect(await nextMessage(b)).toBe("minimal:from-b");

		await Promise.all([closeAndWait(a), closeAndWait(b)]);
	});

	it("does not upgrade an endpoint with no websocket route", async () => {
		expect(connect("/not-a-socket")).rejects.toThrow();
	});

	it("serves plain routes on the same app alongside websocket ones", async () => {
		const res = await fetch(`${BASE_URL}/echo/http`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("http handler");
	});
});

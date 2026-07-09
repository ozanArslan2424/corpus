import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";

beforeEach(() => $registryTesting.reset());

describe("C.WebSocketRoute", () => {
	createTestServer();

	// ─── constructor ──────────────────────────────────────────────

	it("WEBSOCKET ROUTE - VARIANT IS WEBSOCKET", () => {
		const route = new TC.WebSocketRoute("/ws1", { onMessage: () => {} });
		expect(route.variant).toBe("websocket");
	});

	it("WEBSOCKET ROUTE - METHOD IS ALWAYS GET", () => {
		const route = new TC.WebSocketRoute("/ws2", { onMessage: () => {} });
		expect(route.method).toBe(TC.Method.GET);
	});

	it("WEBSOCKET ROUTE - ENDPOINT IS SET", () => {
		const route = new TC.WebSocketRoute("/ws3", { onMessage: () => {} });
		expect(route.endpoint).toBe("/ws3");
	});

	it("WEBSOCKET ROUTE - ID IS SET", () => {
		const route = new TC.WebSocketRoute("/ws4", { onMessage: () => {} });
		expect(route.id).toBe(`${TC.Method.GET} /ws4`);
	});

	it("WEBSOCKET ROUTE - WITHOUT MODEL", () => {
		const route = new TC.WebSocketRoute("/ws7", { onMessage: () => {} });
		expect(route.model).toBeUndefined();
	});
});

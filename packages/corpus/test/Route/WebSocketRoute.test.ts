import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";

beforeEach(() => $registryTesting.reset());

describe("WebSocketRoute", () => {
	createTestServer();

	// ─── constructor ──────────────────────────────────────────────

	it("variant is websocket", () => {
		const route = new TC.WebSocketRoute("/ws1", { onMessage: () => {} });
		expect(route.variant).toBe("websocket");
	});

	it("method is always get", () => {
		const route = new TC.WebSocketRoute("/ws2", { onMessage: () => {} });
		expect(route.method).toBe(TC.Method.GET);
	});

	it("endpoint is set", () => {
		const route = new TC.WebSocketRoute("/ws3", { onMessage: () => {} });
		expect(route.endpoint).toBe("/ws3");
	});

	it("id is set", () => {
		const route = new TC.WebSocketRoute("/ws4", { onMessage: () => {} });
		expect(route.id).toBe(`${TC.Method.GET} /ws4`);
	});

	it("without model", () => {
		const route = new TC.WebSocketRoute("/ws7", { onMessage: () => {} });
		expect(route.model).toBeUndefined();
	});
});

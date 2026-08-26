import { beforeEach, describe, expect, it } from "bun:test";

import { $registry, C } from "#corpus";

import { createTestServer } from "../../../test/utils/createTestServer";

beforeEach(() => $registry.reset());

describe("WebSocketRoute", () => {
	createTestServer();

	// ─── constructor ──────────────────────────────────────────────

	it("variant is websocket", () => {
		const route = new C.WebSocketRoute("/ws1", { onMessage: () => {} });
		expect(route.variant).toBe("websocket");
	});

	it("method is always get", () => {
		const route = new C.WebSocketRoute("/ws2", { onMessage: () => {} });
		expect(route.method).toBe(C.Method.GET);
	});

	it("endpoint is set", () => {
		const route = new C.WebSocketRoute("/ws3", { onMessage: () => {} });
		expect(route.endpoint).toBe("/ws3");
	});

	it("id is set", () => {
		const route = new C.WebSocketRoute("/ws4", { onMessage: () => {} });
		expect(route.id).toBe(`${C.Method.GET} /ws4`);
	});

	it("without model", () => {
		const route = new C.WebSocketRoute("/ws7", { onMessage: () => {} });
		expect(route.model).toBeUndefined();
	});
});

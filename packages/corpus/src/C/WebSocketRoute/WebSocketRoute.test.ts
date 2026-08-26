import { beforeEach, describe, expect, it } from "bun:test";

import { createTestServer } from "#testutils";
import { Method } from "@/C/Method/Method";
import { WebSocketRoute } from "@/C/WebSocketRoute/WebSocketRoute";
import { $registry } from "@/Registry/$registry";

beforeEach(() => $registry.reset());

describe("WebSocketRoute", () => {
	createTestServer();

	// ─── constructor ──────────────────────────────────────────────

	it("variant is websocket", () => {
		const route = new WebSocketRoute("/ws1", { onMessage: () => {} });
		expect(route.variant).toBe("websocket");
	});

	it("method is always get", () => {
		const route = new WebSocketRoute("/ws2", { onMessage: () => {} });
		expect(route.method).toBe(Method.GET);
	});

	it("endpoint is set", () => {
		const route = new WebSocketRoute("/ws3", { onMessage: () => {} });
		expect(route.endpoint).toBe("/ws3");
	});

	it("id is set", () => {
		const route = new WebSocketRoute("/ws4", { onMessage: () => {} });
		expect(route.id).toBe(`${Method.GET} /ws4`);
	});

	it("without model", () => {
		const route = new WebSocketRoute("/ws7", { onMessage: () => {} });
		expect(route.model).toBeUndefined();
	});
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { Method } from "@/Request";
import { RouteVariant } from "@/RouteBase";
import { WebSocketRoute } from "@/RouteBase/WebSocketRoute";

beforeEach(() => {
	// WebSocketRoute.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();
});

afterEach(() => {
	Globals.delete("apps");
});

describe("WebSocketRoute", () => {
	describe("direct construction", () => {
		it("sets the endpoint", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.endpoint).toBe("/chat");
		});

		it("always uses method GET", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.method).toBe(Method.GET);
		});

		it("has variant 'websocket'", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.variant).toBe(RouteVariant.websocket);
		});

		it("stores onMessage from the definition", () => {
			const onMessage = () => {};
			const route = new WebSocketRoute("/chat", { onMessage });
			expect(route.onMessage).toBe(onMessage);
		});

		it("stores onOpen from the definition when provided", () => {
			const onOpen = () => {};
			const route = new WebSocketRoute("/chat", { onMessage: () => {}, onOpen });
			expect(route.onOpen).toBe(onOpen);
		});

		it("stores onClose from the definition when provided", () => {
			const onClose = () => {};
			const route = new WebSocketRoute("/chat", { onMessage: () => {}, onClose });
			expect(route.onClose).toBe(onClose);
		});

		it("leaves onOpen and onClose undefined when not provided", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.onOpen).toBeUndefined();
			expect(route.onClose).toBeUndefined();
		});

		it("leaves config undefined", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.config).toBeUndefined();
		});

		it("registers itself onto the nearest App", () => {
			const app = new App();
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(app.routes).toContain(route);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new WebSocketRoute()).toThrow();
		});

		it("throws when constructed with only an endpoint", () => {
			// @ts-expect-error - exercising the runtime guard for a missing definition
			expect(() => new WebSocketRoute("/chat")).toThrow();
		});
	});

	describe("handler", () => {
		it("returns the route instance itself", () => {
			const route = new WebSocketRoute("/chat", { onMessage: () => {} });
			expect(route.handler({} as never)).toBe(route);
		});
	});
});

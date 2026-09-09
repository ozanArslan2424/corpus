import { beforeEach, describe, expect, it, mock } from "bun:test";

import { App } from "@/App";
import type { Context } from "@/Context";
import { Controller } from "@/Controller";
import { Method } from "@/Request";
import { BundleRoute } from "@/RouteBase/BundleRoute";
import { FileRoute } from "@/RouteBase/FileRoute";
import { Route } from "@/RouteBase/Route";
import { StaticRoute } from "@/RouteBase/StaticRoute";
import { WebSocketRoute } from "@/RouteBase/WebSocketRoute";

// Route classes call this.register(), which pushes onto the nearest App's
// routes array via getNearestApp(). A fresh App must exist before each test.
beforeEach(() => {
	new App();
});

const stubCtx = {} as Context<any | never, any | never, any | never, any | never>;

describe("Controller", () => {
	describe("constructor", () => {
		it("stores the prefix", () => {
			const controller = new Controller("/api");
			expect(controller.prefix).toBe("/api");
		});

		it("allows no prefix", () => {
			const controller = new Controller();
			expect(controller.prefix).toBeUndefined();
		});
	});

	describe("route", () => {
		it("prepends the controller prefix to the endpoint", () => {
			const controller = new Controller("/api");
			const route = controller.route("/users", () => "ok");
			expect(route.endpoint).toBe("/api/users");
		});

		it("works without a prefix", () => {
			const controller = new Controller();
			const route = controller.route("/users", () => "ok");
			expect(route.endpoint).toBe("/users");
		});

		it("defaults to GET when the address has no HTTP verb", () => {
			const controller = new Controller();
			const route = controller.route("/users", () => "ok");
			expect(route.method).toBe(Method.GET);
		});

		it("resolves the method when the address includes an HTTP verb", () => {
			const controller = new Controller();
			const route = controller.route("POST /users", () => "ok");
			expect(route.method).toBe(Method.POST);
		});

		it("returns a Route instance", () => {
			const controller = new Controller();
			const route = controller.route("/users", () => "ok");
			expect(route).toBeInstanceOf(Route);
		});

		it("adds the route's id to routeIds", () => {
			const controller = new Controller();
			const route = controller.route("/users", () => "ok");
			expect(controller.routeIds.has(route.id)).toBe(true);
		});

		it("calls beforeEach before the handler, in order", async () => {
			const controller = new Controller();
			const calls: string[] = [];
			controller.beforeEach = async () => {
				calls.push("beforeEach");
			};
			const route = controller.route("/users", async () => {
				calls.push("handler");
				return "result";
			});

			const result = await route.handler(stubCtx);

			expect(calls).toEqual(["beforeEach", "handler"]);
			expect(result).toBe("result");
		});

		it("still calls the handler when beforeEach is not set", async () => {
			const controller = new Controller();
			const route = controller.route("/users", async () => "result");
			expect(route.handler(stubCtx)).resolves.toBe("result");
		});

		it("passes the same context to both beforeEach and the handler", async () => {
			const controller = new Controller();
			const beforeEach = mock(async () => {});
			const handler = mock(async () => "result");
			controller.beforeEach = beforeEach;
			const route = controller.route("/users", handler);

			await route.handler(stubCtx);

			expect(beforeEach).toHaveBeenCalledWith(stubCtx);
			expect(handler).toHaveBeenCalledWith(stubCtx);
		});
	});

	describe("staticRoute", () => {
		const filePath = "/tmp/corpus-test-does-not-exist.png";

		it("prepends the controller prefix to the endpoint", () => {
			const controller = new Controller("/static");
			const route = controller.staticRoute("/logo.png", filePath);
			expect(route.endpoint).toBe("/static/logo.png");
		});

		it("returns a StaticRoute instance", () => {
			const controller = new Controller();
			const route = controller.staticRoute("/logo.png", filePath);
			expect(route).toBeInstanceOf(StaticRoute);
		});

		it("adds the route's id to routeIds", () => {
			const controller = new Controller();
			const route = controller.staticRoute("/logo.png", filePath);
			expect(controller.routeIds.has(route.id)).toBe(true);
		});

		it("leaves callback undefined when none is provided", () => {
			const controller = new Controller();
			const route = controller.staticRoute("/logo.png", filePath);
			expect(route.callback).toBeUndefined();
		});

		it("wraps the provided callback to call beforeEach first", async () => {
			const controller = new Controller();
			const calls: string[] = [];
			controller.beforeEach = async () => {
				calls.push("beforeEach");
			};
			const route = controller.staticRoute("/logo.png", filePath, async (_c, content) => {
				calls.push("callback");
				return content;
			});

			await route.callback?.(stubCtx, "hello");

			expect(calls).toEqual(["beforeEach", "callback"]);
		});
	});

	describe("fileRoute", () => {
		const filePath = "/tmp/corpus-test-does-not-exist.pdf";

		it("prepends the controller prefix to the endpoint", () => {
			const controller = new Controller("/files");
			const route = controller.fileRoute("/report.pdf", filePath);
			expect(route.endpoint).toBe("/files/report.pdf");
		});

		it("returns a FileRoute instance", () => {
			const controller = new Controller();
			const route = controller.fileRoute("/report.pdf", filePath);
			expect(route).toBeInstanceOf(FileRoute);
		});

		it("adds the route's id to routeIds", () => {
			const controller = new Controller();
			const route = controller.fileRoute("/report.pdf", filePath);
			expect(controller.routeIds.has(route.id)).toBe(true);
		});

		it("does not wrap the handler with beforeEach", async () => {
			const controller = new Controller();
			const beforeEach = mock(async () => {});
			controller.beforeEach = beforeEach;
			const route = controller.fileRoute("/report.pdf", filePath);

			// the file doesn't exist, so the handler throws via onFileNotFound -
			// we only care that beforeEach is never invoked either way.
			try {
				await route.handler(stubCtx as never);
			} catch {}

			expect(beforeEach).not.toHaveBeenCalled();
		});
	});

	describe("websocketRoute", () => {
		it("prepends the controller prefix to the endpoint", () => {
			const controller = new Controller("/ws");
			const route = controller.websocketRoute("/chat", { onMessage: () => {} });
			expect(route.endpoint).toBe("/ws/chat");
		});

		it("returns a WebSocketRoute instance", () => {
			const controller = new Controller();
			const route = controller.websocketRoute("/chat", { onMessage: () => {} });
			expect(route).toBeInstanceOf(WebSocketRoute);
		});

		it("adds the route's id to routeIds", () => {
			const controller = new Controller();
			const route = controller.websocketRoute("/chat", { onMessage: () => {} });
			expect(controller.routeIds.has(route.id)).toBe(true);
		});

		it("passes the definition through unmodified", () => {
			const controller = new Controller();
			const onMessage = () => {};
			const onOpen = () => {};
			const route = controller.websocketRoute("/chat", { onMessage, onOpen });
			expect(route.onMessage).toBe(onMessage);
			expect(route.onOpen).toBe(onOpen);
		});
	});

	describe("bundleRoute", () => {
		const dir = "/tmp/corpus-test-dist";

		it("prepends the controller prefix to the endpoint", () => {
			const controller = new Controller("/app");
			const route = controller.bundleRoute("/*", dir);
			expect(route.endpoint).toBe("/app/*");
		});

		it("returns a BundleRoute instance", () => {
			const controller = new Controller();
			const route = controller.bundleRoute("/*", dir);
			expect(route).toBeInstanceOf(BundleRoute);
		});

		it("adds the route's id to routeIds", () => {
			const controller = new Controller();
			const route = controller.bundleRoute("/*", dir);
			expect(controller.routeIds.has(route.id)).toBe(true);
		});

		it("passes the dir and definition through unmodified", () => {
			const controller = new Controller();
			const definition = {
				indexHtml: { path: "index.html" },
				assetsDir: { path: "assets" },
			};
			const route = controller.bundleRoute("/*", dir, definition);
			expect(route.dir).toBe(dir);
			expect(route.definition).toBe(definition);
		});
	});
});

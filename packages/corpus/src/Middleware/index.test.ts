import { beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Controller } from "@/Controller";
import { Globals } from "@/Globals";
import { Middleware } from "@/Middleware";
import { Route } from "@/RouteBase/Route";

let app: App;

beforeEach(() => {
	// Middleware.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	app = new App();
});

describe("Middleware", () => {
	describe("direct construction", () => {
		it("stores the handler", () => {
			const handler = () => {};
			const middleware = new Middleware({ handler });
			expect(middleware.handler).toBe(handler);
		});

		it("defaults useOn to '*'", () => {
			const middleware = new Middleware({ handler: () => {} });
			expect(middleware.useOn).toBe("*");
		});

		it("stores a custom useOn value when provided", () => {
			const middleware = new Middleware({ handler: () => {}, useOn: "GET /users" });
			expect(middleware.useOn).toBe("GET /users");
		});

		it("stores a custom useOn array when provided", () => {
			const useOn = ["GET /users", "POST /users"];
			const middleware = new Middleware({ handler: () => {}, useOn });
			expect(middleware.useOn).toBe(useOn);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new Middleware()).toThrow();
		});
	});

	describe("register", () => {
		it("adds itself to the nearest App's global ('*') middlewares by default", () => {
			const middleware = new Middleware({ handler: () => {} });
			expect(app.findMiddlewares("anything")).toContain(middleware);
		});

		it("adds itself scoped to a specific route id when useOn is a string", () => {
			const middleware = new Middleware({ handler: () => {}, useOn: "GET /users" });
			expect(app.findMiddlewares("GET /users")).toContain(middleware);
			expect(app.findMiddlewares("GET /other")).not.toContain(middleware);
		});

		it("adds itself scoped to multiple route ids when useOn is an array of strings", () => {
			const middleware = new Middleware({
				handler: () => {},
				useOn: ["GET /users", "POST /users"],
			});
			expect(app.findMiddlewares("GET /users")).toContain(middleware);
			expect(app.findMiddlewares("POST /users")).toContain(middleware);
			expect(app.findMiddlewares("DELETE /users")).not.toContain(middleware);
		});

		it("throws when there is no active App", () => {
			// no App constructed in this test
			Globals.set("apps", []);
			expect(() => new Middleware({ handler: () => {} })).toThrow();
		});
	});

	describe("subclassing", () => {
		class CustomMiddleware extends Middleware {
			constructor(handler: () => void) {
				super();
				this.handler = handler;
			}
		}

		it("bypasses the argument guard when extended", () => {
			const handler = () => {};
			const middleware = new CustomMiddleware(handler);
			expect(middleware.handler).toBe(handler);
		});

		it("does not auto-register when constructed via a subclass without calling register", () => {
			new CustomMiddleware(() => {});
			expect(app.findMiddlewares("anything")).toEqual([]);
		});
	});

	describe("routeIds", () => {
		it("returns ['*'] when useOn is '*'", () => {
			const middleware = new Middleware({ handler: () => {} });
			expect(middleware.routeIds).toEqual(["*"]);
		});

		it("returns ['*'] for a custom wildcard-like string via OrString", () => {
			const middleware = new Middleware({ handler: () => {}, useOn: "*" });
			expect(middleware.routeIds).toEqual(["*"]);
		});

		it("returns a single-item array for a plain string useOn", () => {
			const middleware = new Middleware({ handler: () => {}, useOn: "GET /users" });
			expect(middleware.routeIds).toEqual(["GET /users"]);
		});

		it("resolves a single Route to its id", () => {
			const route = new Route("/users", () => "ok");
			const middleware = new Middleware({ handler: () => {}, useOn: route });
			expect(middleware.routeIds).toEqual([route.id]);
		});

		it("resolves a single Controller to all of its routeIds", () => {
			const controller = new Controller("/api");
			const routeA = controller.route("/a", () => "ok");
			const routeB = controller.route("/b", () => "ok");
			const middleware = new Middleware({ handler: () => {}, useOn: controller });
			expect(middleware.routeIds.sort()).toEqual([routeA.id, routeB.id].sort());
		});

		it("resolves a mixed array of strings, Routes, and Controllers", () => {
			const route = new Route("/solo", () => "ok");
			const controller = new Controller("/api");
			const controllerRoute = controller.route("/thing", () => "ok");

			const middleware = new Middleware({
				handler: () => {},
				useOn: ["GET /manual", route, controller],
			});

			expect(middleware.routeIds.sort()).toEqual(
				["GET /manual", route.id, controllerRoute.id].sort(),
			);
		});

		it("de-duplicates route ids that appear more than once", () => {
			const route = new Route("/users", () => "ok");
			const middleware = new Middleware({
				handler: () => {},
				useOn: [route, route.id, route],
			});
			expect(middleware.routeIds).toEqual([route.id]);
		});

		it("returns an empty array for a Controller with no registered routes", () => {
			const controller = new Controller("/empty");
			const middleware = new Middleware({ handler: () => {}, useOn: controller });
			expect(middleware.routeIds).toEqual([]);
		});
	});
});

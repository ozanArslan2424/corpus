import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { $registry, C } from "#corpus";

import { createTestServer } from "../../../test/utils/createTestServer";

beforeEach(() => $registry.reset());

const s = createTestServer();

let staticFile: string;

beforeAll(async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "controller-"));
	staticFile = path.join(dir, "doc.txt");
	await fs.writeFile(staticFile, "static content");
});

afterAll(async () => {
	await fs.rm(path.dirname(staticFile), { recursive: true, force: true });
});

describe("Controller", () => {
	describe("prefix", () => {
		class PrefixedController extends C.Controller<"/test"> {
			constructor() {
				super("/test");
			}
			_route = this.route("/route", () => "ok");
			_staticRoute = this.staticRoute("/static", staticFile);
			_fileRoute = this.fileRoute("/file", { filePath: staticFile });
			_websocketRoute = this.websocketRoute("/websocket", { onMessage: () => {} });
		}

		const noPrefixController = new C.Controller();
		const prefixController = new PrefixedController();

		it("is optional", () => {
			expect(noPrefixController.prefix).toBeUndefined();
		});

		it("added to routes", () => {
			expect(prefixController._route.endpoint).toBe("/test/route");
		});

		it("added to static routes", () => {
			expect(prefixController._staticRoute.endpoint).toBe("/test/static");
		});

		it("added to file routes", () => {
			expect(prefixController._fileRoute.endpoint).toBe("/test/file");
		});

		it("added to websocket routes", () => {
			expect(prefixController._websocketRoute.endpoint).toBe("/test/websocket");
		});
	});

	describe("beforeEach", () => {
		it("runs before the handlers", async () => {
			const order: Array<string> = [];
			const expectedOrder: Array<string> = [];

			class BeforeEachController extends C.Controller {
				override beforeEach = () => {
					order.push("beforeEach");
				};
				_route = this.route("/route", () => {
					order.push("route handler");
					return "ok";
				});
				_staticRoute = this.staticRoute("/static", staticFile, (_, cn) => {
					order.push("staticRoute handler");
					return cn;
				});
			}
			const beforeEachController = new BeforeEachController();

			await beforeEachController._route.handle({});
			expectedOrder.push("beforeEach", "route handler");
			expect(order).toEqual(expectedOrder);

			const routeRes = await s.handle(beforeEachController._route.request({}));
			expect(routeRes.status).toBe(200);
			expectedOrder.push("beforeEach", "route handler");
			expect(order).toEqual(expectedOrder);

			await beforeEachController._staticRoute.handle({});
			expectedOrder.push("beforeEach", "staticRoute handler");
			expect(order).toEqual(expectedOrder);

			const staticRouteRes = await s.handle(beforeEachController._staticRoute.request({}));
			expect(staticRouteRes.status).toBe(200);
			expectedOrder.push("beforeEach", "staticRoute handler");
			expect(order).toEqual(expectedOrder);
		});

		it("throwing prevents the handler", async () => {
			let handlerRan = false;
			class ThrowingController extends C.Controller {
				override beforeEach = () => {
					throw new C.Exception("unauthorized", C.Status.UNAUTHORIZED);
				};

				_route = this.route("/route", () => {
					handlerRan = true;
					return "ok";
				});
			}
			const throwingController = new ThrowingController();

			const res = await s.handle(throwingController._route.request({}));
			expect(res.status).toBe(401);
			expect(handlerRan).toBe(false);
		});

		it("skips on static route without callback", async () => {
			const order: Array<string> = [];

			class BeforeEachController extends C.Controller {
				override beforeEach = () => {
					order.push("beforeEach");
				};

				_staticRoute = this.staticRoute("/static", staticFile);
			}
			const beforeEachController = new BeforeEachController();

			await beforeEachController._staticRoute.handle({});
			expect(order).toEqual([]);

			const res = await s.handle(beforeEachController._staticRoute.request({}));
			expect(res.status).toBe(200);
			expect(order).toEqual([]);
		});
	});

	describe("routeIds", () => {
		it("collects internal", () => {
			class UsersController extends C.Controller<"/users"> {
				constructor() {
					super("/users");
				}
				list = this.route("/list", () => "listed");
				create = this.route("POST /create", () => "created");
				doc = this.staticRoute("/doc", staticFile);
			}
			const ctrl = new UsersController();

			expect(ctrl.routeIds.size).toBe(3);
			expect(ctrl.routeIds.has(ctrl.list.id)).toBe(true);
			expect(ctrl.routeIds.has(ctrl.create.id)).toBe(true);
			expect(ctrl.routeIds.has(ctrl.doc.id)).toBe(true);
		});

		it("collects external", () => {
			const ctrl = new C.Controller("/users");

			const list = ctrl.route("/list", () => "listed");
			const create = ctrl.route("POST /create", () => "created");
			const doc = ctrl.staticRoute("/doc", staticFile);

			expect(ctrl.routeIds.size).toBe(3);
			expect(ctrl.routeIds.has(list.id)).toBe(true);
			expect(ctrl.routeIds.has(create.id)).toBe(true);
			expect(ctrl.routeIds.has(doc.id)).toBe(true);
		});
	});
});

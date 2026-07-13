import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

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

describe("C.Controller", () => {
	it("PREPENDS PREFIX TO DYNAMIC ROUTES", async () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
			list = this.route("/list", () => "listed");
		}
		new UsersController();

		const res = await s.handle(req("/users/list"));
		expect(res.status).toBe(200);
	});

	it("WORKS WITHOUT A PREFIX", async () => {
		class RootController extends TC.Controller {
			prefix = undefined;
			list = this.route("/plain", () => "plain");
		}
		new RootController();

		const res = await s.handle(req("/plain"));
		expect(res.status).toBe(200);
	});

	it("PRESERVES METHOD FROM STRING ADDRESS", async () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
			create = this.route("POST /create", () => "created");
		}
		const ctrl = new UsersController();

		expect(ctrl.create.method).toBe(TC.Method.POST);
		const res = await s.handle(req("/users/create", { method: "POST" }));
		expect(res.status).toBe(200);
	});

	it("PRESERVES METHOD FROM OBJECT ADDRESS", async () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
			remove = this.route({ method: TC.Method.DELETE, path: "/remove" }, () => "removed");
		}
		const ctrl = new UsersController();

		expect(ctrl.remove.method).toBe(TC.Method.DELETE);
		const res = await s.handle(req("/users/remove", { method: "DELETE" }));
		expect(res.status).toBe(200);
	});

	it("RUNS beforeEach BEFORE THE HANDLER", async () => {
		const order: string[] = [];
		class UsersController extends TC.Controller {
			prefix = "/users";
			override beforeEach = () => {
				order.push("beforeEach");
			};
			list = this.route("/list", () => {
				order.push("handler");
				return "listed";
			});
		}
		new UsersController();

		await s.handle(req("/users/list"));
		expect(order).toEqual(["beforeEach", "handler"]);
	});

	it("beforeEach RUNS PER REQUEST", async () => {
		let count = 0;
		class UsersController extends TC.Controller {
			prefix = "/users";
			override beforeEach = () => {
				count++;
			};
			list = this.route("/list", () => "listed");
		}
		new UsersController();

		await s.handle(req("/users/list"));
		await s.handle(req("/users/list"));
		expect(count).toBe(2);
	});

	it("beforeEach THROWING PREVENTS THE HANDLER", async () => {
		let handlerRan = false;
		class UsersController extends TC.Controller {
			prefix = "/users";
			override beforeEach = () => {
				throw new TC.Exception("unauthorized", TC.Status.UNAUTHORIZED);
			};
			list = this.route("/list", () => {
				handlerRan = true;
				return "listed";
			});
		}
		new UsersController();

		const res = await s.handle(req("/users/list"));
		expect(res.status).toBe(401);
		expect(handlerRan).toBe(false);
	});

	it("COLLECTS ROUTE IDS", () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
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

	it("PREPENDS PREFIX TO STATIC ROUTES", async () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
			doc = this.staticRoute("/doc", staticFile);
		}
		new UsersController();

		const res = await s.handle(req("/users/doc"));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("static content");
	});

	it("RUNS beforeEach BEFORE THE STATIC ROUTE CALLBACK", async () => {
		const order: string[] = [];
		class UsersController extends TC.Controller {
			prefix = "/users";
			override beforeEach = () => {
				order.push("beforeEach");
			};
			doc = this.staticRoute("/doc", staticFile, (_, content) => {
				order.push("callback");
				return content.toUpperCase();
			});
		}
		new UsersController();

		const res = await s.handle(req("/users/doc"));
		expect(await res.text()).toBe("STATIC CONTENT");
		expect(order).toEqual(["beforeEach", "callback"]);
	});

	it("STATIC ROUTE WITHOUT CALLBACK SKIPS beforeEach", async () => {
		// documents current behavior: callback-less static routes stream the
		// file directly, so beforeEach never runs for them
		const order: string[] = [];
		class UsersController extends TC.Controller {
			prefix = "/users";
			override beforeEach = () => {
				order.push("beforeEach");
			};
			doc = this.staticRoute("/doc", staticFile);
		}
		new UsersController();

		const res = await s.handle(req("/users/doc"));
		expect(res.status).toBe(200);
		expect(order).toEqual([]);
	});

	it("PREPENDS PREFIX TO WEBSOCKET ROUTES", () => {
		class UsersController extends TC.Controller {
			prefix = "/users";
			live = this.websocketRoute("/live", { onMessage: () => {} });
		}
		const ctrl = new UsersController();

		expect(ctrl.live.variant).toBe("websocket");
		expect(ctrl.live.endpoint).toBe("/users/live");
		expect(ctrl.routeIds.has(ctrl.live.id)).toBe(true);
	});
});

import { Middleware } from "@/internal/modules/Middleware/Middleware";
import { describe, it, expect } from "bun:test";
import { Controller, Route, Server } from "@/exports";
import { reqMaker } from "test/utils/reqMaker";
import { pathMaker } from "test/utils/pathMaker";

const globalPrefix = "/middleware/use-globally";
const path = pathMaker(globalPrefix);
const req = reqMaker(globalPrefix);

// TODO: Middleware call order is reversed

const register = (pfx: string) => {
	const s = new Server({});
	class TestController extends Controller {
		constructor() {
			super({ prefix: path(pfx) });
		}

		one = this.route("/one", (c) => {
			console.log(c.data);
			return c.data;
		});

		two = this.route("/two", (c) => c.data);

		twoOverride = this.route("/two/override", (c) => c.data);
	}

	new TestController();
	new Route({ method: "GET", path: path("/route") }, (c) => c.data);
	return s;
};

describe("Middleware Data", () => {
	it("use (Global) - One Middleware", async () => {
		const mw1 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		const s = register("/use");
		mw1.use();
		const res = await s.handle(req("/use/one", { method: "GET" }));
		expect(await res.json()).toEqual({ hello: "world" });
	});

	it("useGlobally - Two Middlewares No Override", async () => {
		const mw1 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		const mw2 = new Middleware((c) => {
			c.data.ozan = "arslan";
		});
		const s = register("/two");
		mw2.useGlobally();
		mw1.useGlobally();
		const res = await s.handle(req("/two/two", { method: "GET" }));
		expect(await res.json()).toEqual({
			hello: "world",
			ozan: "arslan",
		});
	});

	it("useGlobally - Two Middlewares WITH Override", async () => {
		const mw1 = new Middleware((c) => {
			c.data.ozan = "arslan";
		});
		const mw2 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		const s = register("/three");
		mw2.useGlobally();
		mw1.useGlobally();
		const res = await s.handle(req("/three/two/override", { method: "GET" }));
		expect(await res.json()).toEqual({ hello: "world" });
	});
});

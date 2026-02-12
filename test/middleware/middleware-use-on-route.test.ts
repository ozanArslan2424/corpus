import { reqMaker } from "../utils/reqMaker";
import { pathMaker } from "../utils/pathMaker";
import { testServer } from "../utils/testServer";
import { Middleware } from "@/internal/modules/Middleware/Middleware";
import { Route } from "@/internal/modules/Route/Route";
import { describe, it, expect } from "bun:test";

const prefix = "/middleware/use-on-route";
const path = pathMaker(prefix);
const req = reqMaker(prefix);

describe("Middleware Data", () => {
	it("use (Route) - One Middleware", async () => {
		const mw1 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		mw1.use(new Route({ method: "GET", path: path("/use") }, (c) => c.data));
		const res = await testServer.handle(req("/use", { method: "GET" }));
		expect(await res.json()).toEqual({ hello: "world" });
	});

	it("useOnRoute - One Middleware", async () => {
		const mw1 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		mw1.useOnRoute(
			new Route({ method: "GET", path: path("/one") }, (c) => c.data),
		);
		const res = await testServer.handle(req("/one", { method: "GET" }));
		expect(await res.json()).toEqual({ hello: "world" });
	});

	it("useOnRoute - Two Middlewares No Override", async () => {
		const mw1 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		const mw2 = new Middleware((c) => {
			c.data.ozan = "arslan";
		});
		mw1.useOnRoute(
			mw2.useOnRoute(
				new Route({ method: "GET", path: path("/two") }, (c) => c.data),
			),
		);
		const res = await testServer.handle(req("/two", { method: "GET" }));
		expect(await res.json()).toEqual({ hello: "world", ozan: "arslan" });
	});

	it("useOnRoute - Two Middlewares WITH Override", async () => {
		const mw1 = new Middleware((c) => {
			c.data.ozan = "arslan";
		});
		const mw2 = new Middleware((c) => {
			c.data = {
				hello: "world",
			};
		});
		mw1.useOnRoute(
			mw2.useOnRoute(
				new Route(
					{ method: "GET", path: path("/two/override") },
					(c) => c.data,
				),
			),
		);
		const res = await testServer.handle(
			req("/two/override", { method: "GET" }),
		);
		expect(await res.json()).toEqual({ hello: "world" });
	});
});

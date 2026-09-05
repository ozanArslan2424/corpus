import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Route } from "@/Route";

const PORT = 48221;
const BASE_URL = `http://localhost:${PORT}`;

let app: App;

beforeAll(async () => {
	initialize();
	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	new Route("/cookies/read", (c) => {
		const name = c.req.cookies.get("name");
		return name ?? "none";
	});

	new Route("/cookies/write", (c) => {
		c.res.cookies.set("issued", "yes");
		return "ok";
	});

	await app.listen();
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Request cookies e2e", () => {
	it("parses a single cookie from a real incoming request", async () => {
		const res = await fetch(`${BASE_URL}/cookies/read`, {
			headers: { Cookie: "name=Ozan" },
		});
		expect(await res.text()).toBe("Ozan");
	});

	it("parses multiple cookies from a real incoming request", async () => {
		const res = await fetch(`${BASE_URL}/cookies/read`, {
			headers: { Cookie: "name=Ozan; other=1" },
		});
		expect(await res.text()).toBe("Ozan");
	});

	it("returns 'none' when no Cookie header is sent", async () => {
		const res = await fetch(`${BASE_URL}/cookies/read`);
		expect(await res.text()).toBe("none");
	});

	it("issues a Set-Cookie header on the response for a real request", async () => {
		const res = await fetch(`${BASE_URL}/cookies/write`);
		expect(res.headers.get("Set-Cookie")).toContain("issued=yes");
	});
});

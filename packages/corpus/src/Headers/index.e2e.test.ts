import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { initialize } from "@/initialize";
import { Route } from "@/Route";

const PORT = 48241;
const BASE_URL = `http://localhost:${PORT}`;

let app: App;

beforeAll(async () => {
	initialize();
	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	new Route("/headers/read-request", (c) => {
		return c.req.headers.get(HeaderKey.UserAgent) ?? "none";
	});

	new Route("/headers/set-string", (c) => {
		c.res.headers.set("X-String", "value");
		return "ok";
	});

	new Route("/headers/set-number", (c) => {
		c.res.headers.set("X-Number", 42);
		return "ok";
	});

	new Route("/headers/set-boolean", (c) => {
		c.res.headers.set("X-Bool", true);
		return "ok";
	});

	new Route("/headers/set-many", (c) => {
		c.res.headers.setMany({ "X-A": "1", "X-B": "2", "X-Empty": "" });
		return "ok";
	});

	new Route("/headers/set-many-from-headers", (c) => {
		const source = new Headers();
		source.append(HeaderKey.SetCookie, "a=1");
		source.append(HeaderKey.SetCookie, "b=2");
		source.set("X-From-Source", "yes");
		c.res.headers.setMany(source);
		return "ok";
	});

	new Route("/headers/cache-control", (c) => {
		c.res.headers.setCacheControl({ public: true, maxAge: 60 });
		return "ok";
	});

	new Route("/headers/content-disposition", (c) => {
		c.res.headers.setContentDisposition({ disposition: "attachment", filename: "file.txt" });
		return "ok";
	});

	await app.listen();
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Headers e2e", () => {
	it("reads a real incoming request header via the typed HeaderKey overload", async () => {
		const res = await fetch(`${BASE_URL}/headers/read-request`, {
			headers: { "User-Agent": "corpus-e2e-client" },
		});
		expect(await res.text()).toBe("corpus-e2e-client");
	});

	it("sets a plain string header on the real response", async () => {
		const res = await fetch(`${BASE_URL}/headers/set-string`);
		expect(res.headers.get("X-String")).toBe("value");
	});

	it("coerces a number value to a string on the real response", async () => {
		const res = await fetch(`${BASE_URL}/headers/set-number`);
		expect(res.headers.get("X-Number")).toBe("42");
	});

	it("coerces a boolean value to a string on the real response", async () => {
		const res = await fetch(`${BASE_URL}/headers/set-boolean`);
		expect(res.headers.get("X-Bool")).toBe("true");
	});

	it("applies multiple headers via setMany, skipping empty values", async () => {
		const res = await fetch(`${BASE_URL}/headers/set-many`);
		expect(res.headers.get("X-A")).toBe("1");
		expect(res.headers.get("X-B")).toBe("2");
		expect(res.headers.has("X-Empty")).toBe(false);
	});

	it("appends multiple Set-Cookie entries (not overwriting) when setMany copies from a Headers instance", async () => {
		const res = await fetch(`${BASE_URL}/headers/set-many-from-headers`);
		const setCookie = res.headers.get(HeaderKey.SetCookie) ?? "";
		expect(setCookie).toContain("a=1");
		expect(setCookie).toContain("b=2");
		expect(res.headers.get("X-From-Source")).toBe("yes");
	});

	it("sets a real Cache-Control header from a definition object", async () => {
		const res = await fetch(`${BASE_URL}/headers/cache-control`);
		expect(res.headers.get(HeaderKey.CacheControl)).toBe("public, max-age=60");
	});

	it("sets a real Content-Disposition header from a definition object", async () => {
		const res = await fetch(`${BASE_URL}/headers/content-disposition`);
		expect(res.headers.get(HeaderKey.ContentDisposition)).toBe('attachment; filename="file.txt"');
	});
});

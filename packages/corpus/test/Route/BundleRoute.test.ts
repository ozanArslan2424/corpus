import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

const s = createTestServer();

let dir: string;
let emptyDir: string;

beforeAll(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-route-"));
	emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-route-empty-"));
	await fs.writeFile(path.join(dir, "index.html"), "<html>INDEX</html>");
	await fs.writeFile(path.join(dir, "favicon.ico"), "icon");
	await fs.writeFile(path.join(dir, "secret.json"), "{}");
	await fs.mkdir(path.join(dir, "assets"), { recursive: true });
	await fs.writeFile(path.join(dir, "assets", "app-abc123.js"), "console.log('app')");
	await fs.mkdir(path.join(dir, "internal"), { recursive: true });
	await fs.writeFile(path.join(dir, "internal", "data.json"), "{}");
});

afterAll(async () => {
	await fs.rm(dir, { recursive: true, force: true });
	await fs.rm(emptyDir, { recursive: true, force: true });
});

describe("C.BundleRoute", () => {
	it("PROPERTIES", () => {
		const route = new TC.BundleRoute("/*", dir);

		expect(route.variant).toBe("bundle");
		expect(route.method).toBe(TC.Method.GET);
		expect(route.endpoint).toBe("/*");
		expect(route.dir).toBe(dir);
		expect(route.id).toBe(`${TC.Method.GET} /*`);
	});

	it("SERVES INDEX AT ROOT", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("SERVES EXISTING ASSET", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/assets/app-abc123.js"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("console.log");
	});

	it("ASSETS DIR GETS IMMUTABLE CACHE HEADER", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/assets/app-abc123.js"));
		expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
	});

	it("ROOT FILES GET FALLBACK CACHE HEADER", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/favicon.ico"));
		// fallback default { public: true, noCache: true } serializes to "no-cache"
		expect(res.headers.get("cache-control")).toBe("no-cache");
	});

	it("SPA FALLBACK FOR EXTENSIONLESS ROUTES", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/settings/profile"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("SPA FALLBACK FOR MISSING NON-HTML FILES", async () => {
		// documents current behavior: a missing asset like /missing.png
		// also falls back to index.html instead of 404
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/missing.png"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("MISSING HTML FILE RETURNS 404", async () => {
		new TC.BundleRoute("/*", dir);

		const res = await s.handle(req("/missing.html"));
		expect(res.status).toBe(404);
	});

	it("NO INDEX AND NO FILE RETURNS 404", async () => {
		new TC.BundleRoute("/*", emptyDir);

		const res = await s.handle(req("/anything"));
		expect(res.status).toBe(404);
	});

	it("CUSTOM CACHE CONFIG REPLACES DEFAULTS", async () => {
		new TC.BundleRoute("/*", dir, {
			indexHtml: { noCache: true },
			assetsDir: { public: true, maxAge: 60 },
			fallback: { noStore: true },
		});

		const asset = await s.handle(req("/assets/app-abc123.js"));
		expect(asset.headers.get("cache-control")).toBe("public, max-age=60");

		const root = await s.handle(req("/favicon.ico"));
		expect(root.headers.get("cache-control")).toBe("no-store");
	});

	it("INDEX HTML GETS THE indexHtml CACHE DIRECTIVE", async () => {
		new TC.BundleRoute("/*", dir, {
			indexHtml: { noStore: true },
			assetsDir: { public: true, maxAge: 31536000, immutable: true },
			fallback: { public: true, noCache: true },
		});

		const res = await s.handle(req("/"));
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("IGNORE EXACT MATCH RETURNS 404", async () => {
		class IgnoringBundle extends TC.BundleRoute {
			protected override ignore: string[] = ["secret.json"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/secret.json"));
		expect(res.status).toBe(404);
	});

	it("IGNORE PREFIX MATCH WITH LEADING SLASH RETURNS 404", async () => {
		class IgnoringBundle extends TC.BundleRoute {
			protected override ignore: string[] = ["/internal/*"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/internal/data.json"));
		expect(res.status).toBe(404);
	});

	it("IGNORE PREFIX MATCH WITHOUT LEADING SLASH RETURNS 404", async () => {
		class IgnoringBundle extends TC.BundleRoute {
			protected override ignore: string[] = ["internal/*"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/internal/data.json"));
		expect(res.status).toBe(404);
	});

	it("SUB-PATH MOUNT SERVES ASSETS RELATIVE TO THE MOUNT", async () => {
		new TC.BundleRoute("/app/*", dir);

		const res = await s.handle(req("/app/assets/app-abc123.js"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("console.log");
	});

	it("PATH TRAVERSAL DOES NOT ESCAPE THE BUNDLE DIR", async () => {
		// sibling of `dir` inside the same tmp parent, reachable via a single ../
		const parent = path.dirname(dir);
		const outsideName = `outside-${path.basename(dir)}.txt`;
		await fs.writeFile(path.join(parent, outsideName), "OUTSIDE");
		new TC.BundleRoute("/*", dir);

		const raw = await s.handle(req(`/../${outsideName}`));
		expect(await raw.text()).not.toContain("OUTSIDE");

		const encoded = await s.handle(req(`/%2e%2e/${outsideName}`));
		expect(await encoded.text()).not.toContain("OUTSIDE");

		const mixed = await s.handle(req(`/assets/..%2f..%2f${outsideName}`));
		expect(await mixed.text()).not.toContain("OUTSIDE");

		await fs.rm(path.join(parent, outsideName), { force: true });
	});
});

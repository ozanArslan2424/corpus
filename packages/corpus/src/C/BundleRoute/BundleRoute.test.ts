import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { createTestServer, req } from "#testutils";
import { BundleRoute } from "@/C/BundleRoute/BundleRoute";
import { Method } from "@/C/Req/Method";
import { $registry } from "@/Registry/$registry";

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

afterEach(() => $registry.reset());

afterAll(async () => {
	await fs.rm(dir, { recursive: true, force: true });
	await fs.rm(emptyDir, { recursive: true, force: true });
});

describe("BundleRoute", () => {
	it("properties", () => {
		const route = new BundleRoute("/*", dir);

		expect(route.variant).toBe("bundle");
		expect(route.method).toBe(Method.GET);
		expect(route.endpoint).toBe("/*");
		expect(route.dir).toBe(dir);
		expect(route.id).toBe(`${Method.GET} /*`);
	});

	it("serves index at root", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("serves existing asset", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/assets/app-abc123.js"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("console.log");
	});

	it("assets dir gets immutable cache header", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/assets/app-abc123.js"));
		expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
	});

	it("root files get fallback cache header", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/favicon.ico"));
		// fallback default { public: true, noCache: true } serializes to "no-cache"
		expect(res.headers.get("cache-control")).toBe("no-cache");
	});

	it("spa fallback for extensionless routes", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/settings/profile"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("spa fallback for missing non-html files", async () => {
		// documents current behavior: a missing asset like /missing.png
		// also falls back to index.html instead of 404
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/missing.png"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("INDEX");
	});

	it("missing html file returns 404", async () => {
		new BundleRoute("/*", dir);

		const res = await s.handle(req("/missing.html"));
		expect(res.status).toBe(404);
	});

	it("no index and no file returns 404", async () => {
		new BundleRoute("/*", emptyDir);

		const res = await s.handle(req("/anything"));
		expect(res.status).toBe(404);
	});

	it("custom cache config replaces defaults", async () => {
		new BundleRoute("/*", dir, {
			indexHtml: { noCache: true },
			assetsDir: { public: true, maxAge: 60 },
			fallback: { noStore: true },
		});

		const asset = await s.handle(req("/assets/app-abc123.js"));
		expect(asset.headers.get("cache-control")).toBe("public, max-age=60");

		const root = await s.handle(req("/favicon.ico"));
		expect(root.headers.get("cache-control")).toBe("no-store");
	});

	it("index html gets the indexhtml cache directive", async () => {
		new BundleRoute("/*", dir, {
			indexHtml: { noStore: true },
			assetsDir: { public: true, maxAge: 31536000, immutable: true },
			fallback: { public: true, noCache: true },
		});

		const res = await s.handle(req("/"));
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("ignore exact match returns 404", async () => {
		class IgnoringBundle extends BundleRoute {
			protected override ignore: string[] = ["secret.json"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/secret.json"));
		expect(res.status).toBe(404);
	});

	it("ignore prefix match with leading slash returns 404", async () => {
		class IgnoringBundle extends BundleRoute {
			protected override ignore: string[] = ["/internal/*"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/internal/data.json"));
		expect(res.status).toBe(404);
	});

	it("ignore prefix match without leading slash returns 404", async () => {
		class IgnoringBundle extends BundleRoute {
			protected override ignore: string[] = ["internal/*"];
		}
		new IgnoringBundle("/*", dir);

		const res = await s.handle(req("/internal/data.json"));
		expect(res.status).toBe(404);
	});

	it("sub-path mount serves assets relative to the mount", async () => {
		new BundleRoute("/app/*", dir);

		const res = await s.handle(req("/app/assets/app-abc123.js"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("console.log");
	});

	it("path traversal does not escape the bundle dir", async () => {
		// sibling of `dir` inside the same tmp parent, reachable via a single ../
		const parent = path.dirname(dir);
		const outsideName = `outside-${path.basename(dir)}.txt`;
		await fs.writeFile(path.join(parent, outsideName), "OUTSIDE");
		new BundleRoute("/*", dir);

		const raw = await s.handle(req(`/../${outsideName}`));
		expect(await raw.text()).not.toContain("OUTSIDE");

		const encoded = await s.handle(req(`/%2e%2e/${outsideName}`));
		expect(await encoded.text()).not.toContain("OUTSIDE");

		const mixed = await s.handle(req(`/assets/..%2f..%2f${outsideName}`));
		expect(await mixed.text()).not.toContain("OUTSIDE");

		await fs.rm(path.join(parent, outsideName), { force: true });
	});
});

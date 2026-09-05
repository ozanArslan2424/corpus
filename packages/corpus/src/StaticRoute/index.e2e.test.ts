import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Res, Status } from "@/Res";
import { StaticRoute } from "@/StaticRoute";

const PORT = 48193;
const BASE_URL = `http://localhost:${PORT}`;

const PAGE_HTML = "<html><body>static page</body></html>";
const TEMPLATE_HTML = "<html><body>Hello, {{name}}</body></html>";
const LOGO_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let dir: string;
let app: App;
let mutableRoute: StaticRoute;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "static-route-e2e-"));
	fs.writeFileSync(path.join(dir, "page.html"), PAGE_HTML);
	fs.writeFileSync(path.join(dir, "template.html"), TEMPLATE_HTML);
	fs.writeFileSync(path.join(dir, "logo.png"), LOGO_BYTES);

	// no callback: raw bytes, default cache
	new StaticRoute("GET /page", path.join(dir, "page.html"));

	// binary file, to prove bytes are served untouched
	new StaticRoute("GET /logo.png", path.join(dir, "logo.png"));

	// callback receives the decoded content and can rewrite it
	new StaticRoute<never, { name?: string }>(
		"GET /template",
		path.join(dir, "template.html"),
		(c, content) => content.replace("{{name}}", (c.search as { name?: string }).name ?? "world"),
	);

	// callback returning a Res, which must win over the buffered bytes
	new StaticRoute("GET /callback-res", path.join(dir, "page.html"), () => {
		return new Res({ fromCallback: true }, { status: Status.ACCEPTED });
	});

	// custom cache, stripped out of the config before it reaches the parsers
	new StaticRoute("GET /cached", path.join(dir, "page.html"), undefined, {
		cache: { public: true, maxAge: 60, immutable: true },
	});

	// non-GET method resolved off the address
	new StaticRoute("POST /page", path.join(dir, "page.html"));

	// file absent at construction time: bytes never load
	new StaticRoute("GET /missing", path.join(dir, "does-not-exist.html"));

	mutableRoute = new StaticRoute("GET /mutable", path.join(dir, "page.html"));

	await app.listen();
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("StaticRoute e2e", () => {
	it("serves the file content buffered at construction time", async () => {
		const res = await fetch(`${BASE_URL}/page`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(PAGE_HTML);
		expect(res.headers.get("Content-Type")).toContain("text/html");
		expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(PAGE_HTML)));
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});

	it("serves binary content without corrupting it", async () => {
		const res = await fetch(`${BASE_URL}/logo.png`);
		expect(res.status).toBe(200);
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(LOGO_BYTES);
		expect(res.headers.get("Content-Type")).toContain("image/png");
	});

	it("passes the decoded content to the callback and sends what it returns", async () => {
		const res = await fetch(`${BASE_URL}/template?name=Ozan`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html><body>Hello, Ozan</body></html>");
	});

	it("runs the callback per request rather than once", async () => {
		const first = await fetch(`${BASE_URL}/template?name=one`);
		const second = await fetch(`${BASE_URL}/template?name=two`);
		expect(await first.text()).toContain("one");
		expect(await second.text()).toContain("two");
	});

	it("uses a Res returned from the callback, including its status", async () => {
		const res = await fetch(`${BASE_URL}/callback-res`);
		expect(res.status).toBe(202);
		expect(await res.json()).toEqual({ fromCallback: true });
	});

	it("applies a custom cache definition", async () => {
		const res = await fetch(`${BASE_URL}/cached`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, immutable");
	});

	it("serves on the method resolved from the address", async () => {
		const res = await fetch(`${BASE_URL}/page`, { method: "POST" });
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(PAGE_HTML);
	});

	it("404s when the file did not exist at construction time", async () => {
		const res = await fetch(`${BASE_URL}/missing`);
		expect(res.status).toBe(404);
	});

	it("keeps serving the buffered bytes after the file changes on disk", async () => {
		fs.writeFileSync(path.join(dir, "page.html"), "<html><body>changed</body></html>");
		try {
			const res = await fetch(`${BASE_URL}/mutable`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe(PAGE_HTML);
		} finally {
			fs.writeFileSync(path.join(dir, "page.html"), PAGE_HTML);
		}
	});

	it("404s when bytes are cleared after construction", async () => {
		mutableRoute.bytes = null;
		try {
			const res = await fetch(`${BASE_URL}/mutable`);
			expect(res.status).toBe(404);
		} finally {
			mutableRoute.bytes = mutableRoute.file?.bytes() ?? null;
		}
	});
});

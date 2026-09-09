import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { BundleRoute } from "@/RouteBase/BundleRoute";

const PORT = 48179;
const BASE_URL = `http://localhost:${PORT}`;

const INDEX_HTML = "<html><body>spa shell</body></html>";
const SHELL_HTML = "<html><body>custom shell</body></html>";
const ASSET_JS = "console.log('hashed asset');";
const ASSET_CSS = "body{margin:0}";
const SECRET_TXT = "do-not-serve-me";
const CONFIG_JSON = '{"ignored":true}';

let dir: string;
let customDir: string;
let app: App;

beforeAll(async () => {
	initialize();
	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	// default-definition bundle
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-route-e2e-"));
	fs.mkdirSync(path.join(dir, "assets"));
	fs.mkdirSync(path.join(dir, "private"));
	fs.writeFileSync(path.join(dir, "index.html"), INDEX_HTML);
	fs.writeFileSync(path.join(dir, "assets", "index-a1b2c3.js"), ASSET_JS);
	fs.writeFileSync(path.join(dir, "favicon.ico"), "icon-bytes");
	fs.writeFileSync(path.join(dir, "config.json"), CONFIG_JSON);
	fs.writeFileSync(path.join(dir, "private", "secret.txt"), SECRET_TXT);

	const bundle = new BundleRoute("/app/*", dir);
	bundle.ignore = ["config.json", "private/*"];

	// custom-definition bundle: renamed index, renamed assets dir, custom 404
	customDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-route-e2e-custom-"));
	fs.mkdirSync(path.join(customDir, "static"));
	fs.writeFileSync(path.join(customDir, "shell.html"), SHELL_HTML);
	fs.writeFileSync(path.join(customDir, "static", "app-9f8e7d.css"), ASSET_CSS);

	const custom = new BundleRoute("/custom/*", customDir, {
		indexHtml: { path: "shell.html", noCache: true },
		assetsDir: { path: "static", public: true, maxAge: 600 },
		fallback: { public: true, maxAge: 60 },
	});
	custom.onFileNotFound = (subPath) => `custom-not-found:${subPath}`;

	await app.listen();
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	fs.rmSync(customDir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("BundleRoute e2e", () => {
	it("serves index.html at the bundle root with a revalidating cache policy", async () => {
		const res = await fetch(`${BASE_URL}/app/`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(INDEX_HTML);
		expect(res.headers.get("Content-Type")).toContain("text/html");
		expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(INDEX_HTML)));
		expect(res.headers.get("Cache-Control")).toContain("no-cache");
	});

	it("serves hashed assets as a stream with an immutable long-lived cache policy", async () => {
		const res = await fetch(`${BASE_URL}/app/assets/index-a1b2c3.js`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(ASSET_JS);
		expect(res.headers.get("Content-Type")).toContain("javascript");

		const cache = res.headers.get("Cache-Control");
		expect(cache).toContain("max-age=31536000");
		expect(cache).toContain("immutable");

		const disposition = res.headers.get("Content-Disposition");
		expect(disposition).toContain("inline");
		expect(disposition).toContain("index-a1b2c3.js");
	});

	it("falls back to index.html for client-side routes that have no file on disk", async () => {
		const res = await fetch(`${BASE_URL}/app/dashboard/settings`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(INDEX_HTML);
		expect(res.headers.get("Cache-Control")).toContain("no-cache");
	});

	it("serves unhashed root files with the fallback cache policy", async () => {
		const res = await fetch(`${BASE_URL}/app/favicon.ico`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("icon-bytes");
		expect(res.headers.get("Cache-Control")).toContain("no-cache");
		expect(res.headers.get("Content-Disposition")).toContain("inline");
	});

	it("serves index.html instead of an exact-match ignored file", async () => {
		const res = await fetch(`${BASE_URL}/app/config.json`);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toBe(CONFIG_JSON);
		expect(text).toBe(INDEX_HTML);
	});

	it("serves index.html instead of a wildcard-ignored file", async () => {
		const res = await fetch(`${BASE_URL}/app/private/secret.txt`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toBe(INDEX_HTML);
		expect(body).not.toContain(SECRET_TXT);
	});

	it("404s for a missing html file rather than recursing into the index fallback", async () => {
		const res = await fetch(`${BASE_URL}/app/missing.html`);
		expect(res.status).toBe(404);
	});

	it("does not escape the bundle dir via percent-encoded traversal", async () => {
		const res = await fetch(`${BASE_URL}/app/%2e%2e%2f%2e%2e%2fpackage.json`);
		expect(res.status).toBe(404);
	});

	it("honors a custom indexHtml path at the bundle root", async () => {
		const res = await fetch(`${BASE_URL}/custom/`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(SHELL_HTML);
		expect(res.headers.get("Cache-Control")).toContain("no-cache");
	});

	it("honors a custom assetsDir path and cache definition", async () => {
		const res = await fetch(`${BASE_URL}/custom/static/app-9f8e7d.css`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(ASSET_CSS);
		expect(res.headers.get("Content-Type")).toContain("css");
		expect(res.headers.get("Cache-Control")).toContain("max-age=600");
	});

	it("honors an overridden onFileNotFound", async () => {
		const res = await fetch(`${BASE_URL}/custom/missing.html`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("custom-not-found:/missing.html");
	});
});

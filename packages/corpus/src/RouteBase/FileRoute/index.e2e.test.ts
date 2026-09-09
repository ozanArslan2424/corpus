import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { FileRoute } from "@/RouteBase/FileRoute";

const PORT = 48187;
const BASE_URL = `http://localhost:${PORT}`;

const REPORT_TXT = "quarterly numbers go here";
const PAGE_HTML = "<html><body>inline page</body></html>";

let dir: string;
let app: App;
let missingRoute: FileRoute;

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "file-route-e2e-"));
	fs.writeFileSync(path.join(dir, "report.txt"), REPORT_TXT);
	fs.writeFileSync(path.join(dir, "page.html"), PAGE_HTML);

	// string shorthand: no disposition, so the body is buffered bytes
	new FileRoute("GET /page", path.join(dir, "page.html"));

	// definition form with a disposition: the body is streamed
	new FileRoute("GET /download", {
		filePath: path.join(dir, "report.txt"),
		disposition: "attachment",
	});

	// custom cache definitions
	new FileRoute("GET /cached", {
		filePath: path.join(dir, "report.txt"),
		disposition: "inline",
		cache: { public: false, maxAge: 60 },
	});

	new FileRoute("GET /no-cache", {
		filePath: path.join(dir, "report.txt"),
		cache: { noCache: true, maxAge: 60 },
	});

	// non-GET method, resolved off the address
	new FileRoute("POST /generate", path.join(dir, "report.txt"));

	missingRoute = new FileRoute("GET /missing", path.join(dir, "does-not-exist.txt"));

	new FileRoute("GET /custom-missing", path.join(dir, "does-not-exist.txt"));

	await app.listen();
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("FileRoute e2e", () => {
	it("serves a file as buffered bytes when no disposition is configured", async () => {
		const res = await fetch(`${BASE_URL}/page`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(PAGE_HTML);
		expect(res.headers.get("Content-Type")).toContain("text/html");
		expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(PAGE_HTML)));
		expect(res.headers.get("Content-Disposition")).toBeNull();
		expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
	});

	it("streams the file with a disposition header when one is configured", async () => {
		const res = await fetch(`${BASE_URL}/download`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(REPORT_TXT);

		const disposition = res.headers.get("Content-Disposition");
		expect(disposition).toContain("attachment");
		expect(disposition).toContain("report.txt");
		expect(res.headers.get("Content-Type")).toContain("text/plain");
	});

	it("applies a custom cache definition", async () => {
		const res = await fetch(`${BASE_URL}/cached`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("max-age=60");
	});

	it("lets noCache override the rest of the cache definition", async () => {
		const res = await fetch(`${BASE_URL}/no-cache`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
	});

	it("serves on the method resolved from the address", async () => {
		const res = await fetch(`${BASE_URL}/generate`, { method: "POST" });
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(REPORT_TXT);

		const wrongMethod = await fetch(`${BASE_URL}/generate`);
		expect(wrongMethod.status).toBe(404);
	});

	it("404s when the file is missing", async () => {
		const res = await fetch(`${BASE_URL}/missing`);
		expect(res.status).toBe(404);
	});

	it("resolves the file per request rather than at construction time", async () => {
		const filePath = path.join(dir, "does-not-exist.txt");
		fs.writeFileSync(filePath, "created after listen");
		try {
			const res = await fetch(`${BASE_URL}/missing`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("created after listen");
		} finally {
			fs.rmSync(filePath, { force: true });
		}
	});

	it("honors an overridden onFileNotFound", async () => {
		missingRoute.onFileNotFound = async () => "nothing here";
		try {
			const res = await fetch(`${BASE_URL}/missing`);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("nothing here");
		} finally {
			missingRoute.onFileNotFound = () => {
				throw new Error("reset");
			};
		}
	});
});

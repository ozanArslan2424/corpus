import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { Status } from "@/Res";
import { Route } from "@/Route";

const PORT = 48230;
const BASE_URL = `http://localhost:${PORT}`;

let dir: string;
let filePath: string;
let app: App;

beforeAll(async () => {
	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "res-e2e-"));
	filePath = path.join(dir, "report.txt");
	fs.writeFileSync(filePath, "downloadable report");

	new Route("/cookies/set", (c) => {
		c.res.cookies.set("name", "Ozan");
		return "ok";
	});

	new Route("/cookies/set-multiple", (c) => {
		c.res.cookies.set("a", "1");
		c.res.cookies.set("b", "2");
		return "ok";
	});

	new Route("/cookies/delete", (c) => {
		c.res.cookies.set("name", "Ozan");
		c.res.cookies.delete("name");
		return "ok";
	});

	new Route("/redirect", (c) => {
		return c.res.redirect("/somewhere-else", 302);
	});

	new Route("/permanent-redirect", (c) => {
		return c.res.permanentRedirect("/somewhere-else");
	});

	new Route("/download", (c) => {
		return c.res.file(filePath);
	});

	new Route("/sse", (c) => {
		return c.res.sse((send) => {
			send({ data: "hello" });
		});
	});

	await app.listen();
});

afterAll(async () => {
	await app.close();
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

describe("Res cookies e2e", () => {
	it("reflects a single cookie set in the handler as a real Set-Cookie response header", async () => {
		const res = await fetch(`${BASE_URL}/cookies/set`);
		expect(res.headers.get("Set-Cookie")).toContain("name=Ozan");
	});

	it("reflects multiple cookies set in the handler, each as its own Set-Cookie entry", async () => {
		const res = await fetch(`${BASE_URL}/cookies/set-multiple`);
		const header = res.headers.get("Set-Cookie") ?? "";
		expect(header).toContain("a=1");
		expect(header).toContain("b=2");
	});

	it("issues a real expiring Set-Cookie header when a cookie is deleted in the handler", async () => {
		const res = await fetch(`${BASE_URL}/cookies/delete`);
		const header = res.headers.get("Set-Cookie") ?? "";
		expect(header).toContain("name=;");
		expect(header.toLowerCase()).toContain("expires=");
	});
});

describe("Res redirects e2e", () => {
	it("returns a real 302 response with the Location header set", async () => {
		const res = await fetch(`${BASE_URL}/redirect`, { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/somewhere-else");
	});

	it("returns a real 301 response for a permanent redirect", async () => {
		const res = await fetch(`${BASE_URL}/permanent-redirect`, { redirect: "manual" });
		expect(res.status).toBe(Status.MOVED_PERMANENTLY);
	});
});

describe("Res file serving e2e", () => {
	it("streams the actual file content with correct headers", async () => {
		const res = await fetch(`${BASE_URL}/download`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("downloadable report");
		expect(res.headers.get("Content-Type")).toBe("text/plain");
		expect(res.headers.get("Content-Length")).toBe(
			Buffer.byteLength("downloadable report").toString(),
		);
	});
});

describe("Res sse e2e", () => {
	it("streams a real text/event-stream response", async () => {
		const res = await fetch(`${BASE_URL}/sse`);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");
		expect(res.body).not.toBeNull();

		const reader = res.body!.getReader();
		const { value } = await reader.read();
		const chunk = new TextDecoder().decode(value);
		expect(chunk).toBe('data: "hello"\n\n');
	});
});

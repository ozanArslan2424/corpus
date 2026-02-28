import C from "@/index";
import { describe, expect, it } from "bun:test";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";
import { RouteVariant } from "@/Route/enums/RouteVariant";

const s = createTestServer();

const f = (file: string) => C.Config.resolvePath("test", "fixtures", file);

describe("C.StaticRoute", () => {
	// ─── constructor ──────────────────────────────────────────────

	it("STATIC ROUTE - VARIANT IS STATIC", () => {
		const route = new C.StaticRoute("/sr1", f("sample.html"));
		expect(route.variant).toBe(RouteVariant.static);
	});

	it("STATIC ROUTE - METHOD IS ALWAYS GET", () => {
		const route = new C.StaticRoute("/sr2", f("sample.html"));
		expect(route.method).toBe(C.Method.GET);
	});

	it("STATIC ROUTE - ENDPOINT IS SET", () => {
		const route = new C.StaticRoute("/sr3", f("sample.html"));
		expect(route.endpoint).toBe("/sr3");
	});

	it("STATIC ROUTE - ID IS SET", () => {
		const route = new C.StaticRoute("/sr4", f("sample.html"));
		expect(route.id).toBe(C.Route.makeRouteId(C.Method.GET, "/sr4"));
	});

	it("STATIC ROUTE - PATTERN IS SET", () => {
		const route = new C.StaticRoute("/sr5", f("sample.html"));
		expect(route.pattern).toBeInstanceOf(RegExp);
		expect(route.pattern.test("/sr5")).toBe(true);
		expect(route.pattern.test("/other")).toBe(false);
	});

	it("STATIC ROUTE - WITH MODEL", () => {
		const model = { response: undefined };
		const route = new C.StaticRoute("/sr6", f("sample.html"), undefined, model);
		expect(route.model).toBe(model);
	});

	it("STATIC ROUTE - WITHOUT MODEL", () => {
		const route = new C.StaticRoute("/sr7", f("sample.html"));
		expect(route.model).toBeUndefined();
	});

	// ─── mime types & content ─────────────────────────────────────

	it("SERVES HTML WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-html", f("sample.html"));
		const res = await s.handle(req("/sr-html"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html");
		const body = await res.text();
		expect(body).toContain("<h1>Hello</h1>");
	});

	it("SERVES CSS WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-css", f("sample.css"));
		const res = await s.handle(req("/sr-css"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/css");
		const body = await res.text();
		expect(body).toContain("font-family");
	});

	it("SERVES JS WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-js", f("sample.js"));
		const res = await s.handle(req("/sr-js"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/javascript");
		const body = await res.text();
		expect(body).toContain("hello");
	});

	it("SERVES TS TRANSPILED WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-ts", f("sample.ts"));
		const res = await s.handle(req("/sr-ts"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/javascript");
		const body = await res.text();
		// TS type annotation should be stripped after transpilation
		expect(body).not.toContain(": string");
		expect(body).toContain("hello");
	});

	it("SERVES TXT WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-txt", f("sample.txt"));
		const res = await s.handle(req("/sr-txt"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/plain");
		const body = await res.text();
		expect(body).toContain("hello world");
	});

	it("SERVES JSON WITH CORRECT CONTENT TYPE", async () => {
		new C.StaticRoute("/sr-json", f("sample.json"));
		const res = await s.handle(req("/sr-json"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		const body = await res.text();
		expect(body).toContain("world");
	});

	// ─── content length ───────────────────────────────────────────

	it("SETS CONTENT LENGTH HEADER", async () => {
		new C.StaticRoute("/sr-content-length", f("sample.txt"));
		const res = await s.handle(req("/sr-content-length"));
		const contentLength = res.headers.get("Content-Length");
		expect(contentLength).not.toBeNull();
		expect(Number(contentLength)).toBeGreaterThan(0);
	});

	// ─── not found ────────────────────────────────────────────────

	it("RETURNS 404 WHEN FILE DOES NOT EXIST", async () => {
		new C.StaticRoute("/sr-missing", f("does-not-exist.html"));
		const res = await s.handle(req("/sr-missing"));
		expect(res.status).toBe(404);
	});

	// ─── custom handler ───────────────────────────────────────────

	it("CUSTOM HANDLER RECEIVES CONTENT AND CAN MODIFY IT", async () => {
		new C.StaticRoute("/sr-custom", f("sample.txt"), (_, content) => {
			// trim for trailing \n
			return content.trim() + " modified";
		});
		const res = await s.handle(req("/sr-custom"));
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("hello world modified");
	});

	it("CUSTOM HANDLER CAN SET RESPONSE STATUS", async () => {
		new C.StaticRoute("/sr-custom-status", f("sample.txt"), (c, content) => {
			c.res.status = 202;
			return content;
		});
		const res = await s.handle(req("/sr-custom-status"));
		expect(res.status).toBe(202);
	});

	// ─── unknown extension ────────────────────────────────────────

	it("UNKNOWN EXTENSION FALLS BACK TO OCTET STREAM", async () => {
		// manually test mime fallback via a route pointing to a fake extension
		new C.StaticRoute("/sr-bin", f("sample.xyz"));
		const res = await s.handle(req("/sr-bin"));
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
	});
});

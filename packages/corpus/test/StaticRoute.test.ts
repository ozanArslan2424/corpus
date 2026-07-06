import { beforeEach, describe, expect, it } from "bun:test";
import path from "node:path";

import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

beforeEach(() => $registryTesting.reset());

describe("C.StaticRoute", () => {
	const s = createTestServer();
	const f = (file: string) => path.resolve("test", "fixtures", file);

	// ─── constructor ──────────────────────────────────────────────

	it("STATIC ROUTE - VARIANT IS STATIC", () => {
		const route = new TC.StaticRoute("/sr1", f("sample.html"));
		expect(route.variant).toBe("static");
	});

	it("STATIC ROUTE - METHOD IS ALWAYS GET", () => {
		const route = new TC.StaticRoute("/sr2", f("sample.html"));
		expect(route.method).toBe(TC.Method.GET);
	});

	it("STATIC ROUTE - ENDPOINT IS SET", () => {
		const route = new TC.StaticRoute("/sr3", f("sample.html"));
		expect(route.endpoint).toBe("/sr3");
	});

	it("STATIC ROUTE - ID IS SET", () => {
		const route = new TC.StaticRoute("/sr4", f("sample.html"));
		expect(route.id).toBe(`${TC.Method.GET} /sr4`);
	});

	it("STATIC ROUTE - WITH MODEL", () => {
		const model = { response: undefined };
		const route = new TC.StaticRoute("/sr6", f("sample.html"), undefined, model);
		expect(route.model).toBe(model);
	});

	it("STATIC ROUTE - WITHOUT MODEL", () => {
		const route = new TC.StaticRoute("/sr7", f("sample.html"));
		expect(route.model).toBeUndefined();
	});

	// ─── mime types & content ─────────────────────────────────────

	it("SERVES HTML WITH CORRECT CONTENT TYPE", async () => {
		new TC.StaticRoute("/sr-html", f("sample.html"));
		const res = await s.handle(req("/sr-html"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html");
		const body = await res.text();
		expect(body).toContain("<h1>Hello</h1>");
	});

	it("SERVES CSS WITH CORRECT CONTENT TYPE", async () => {
		new TC.StaticRoute("/sr-css", f("sample.css"));
		const res = await s.handle(req("/sr-css"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/css");
		const body = await res.text();
		expect(body).toContain("font-family");
	});

	it("SERVES JS WITH CORRECT CONTENT TYPE", async () => {
		new TC.StaticRoute("/sr-js", f("sample.js"));
		const res = await s.handle(req("/sr-js"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/javascript");
		const body = await res.text();
		expect(body).toContain("hello");
	});

	// @deprecated
	// it("SERVES TS TRANSPILED WITH CORRECT CONTENT TYPE", async () => {
	// 	new C.StaticRoute("/sr-ts", f("sample.ts"));
	// 	const res = await s.handle(req("/sr-ts"));
	// 	expect(res.status).toBe(200);
	// 	expect(res.headers.get("Content-Type")).toBe("application/javascript");
	// 	const body = await res.text();
	// 	// TS type annotation should be stripped after transpilation
	// 	expect(body).not.toContain(": string");
	// 	expect(body).toContain("hello");
	// });

	it("SERVES TXT WITH CORRECT CONTENT TYPE", async () => {
		new TC.StaticRoute("/sr-txt", f("sample.txt"));
		const res = await s.handle(req("/sr-txt"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/plain");
		const body = await res.text();
		expect(body).toContain("hello world");
	});

	it("SERVES JSON WITH CORRECT CONTENT TYPE", async () => {
		new TC.StaticRoute("/sr-json", f("sample.json"));
		const res = await s.handle(req("/sr-json"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		const body = await res.text();
		expect(body).toContain("world");
	});

	// ─── content length ───────────────────────────────────────────

	it("SETS CONTENT LENGTH HEADER", async () => {
		new TC.StaticRoute("/sr-content-length", f("sample.txt"));
		const res = await s.handle(req("/sr-content-length"));
		const contentLength = res.headers.get("Content-Length");
		expect(contentLength).not.toBeNull();
		expect(Number(contentLength)).toBeGreaterThan(0);
	});

	// ─── not found ────────────────────────────────────────────────

	it("RETURNS 404 WHEN FILE DOES NOT EXIST", async () => {
		new TC.StaticRoute("/sr-missing", f("does-not-exist.html"));
		const res = await s.handle(req("/sr-missing"));
		expect(res.status).toBe(404);
	});

	// ─── custom handler ───────────────────────────────────────────

	it("CUSTOM HANDLER RECEIVES CONTENT AND CAN MODIFY IT", async () => {
		new TC.StaticRoute("/sr-custom", f("sample.txt"), (c, content) => {
			// trim for trailing \n
			return content.trim() + " " + (c.search as any).hello;
		});
		const res = await s.handle(req("/sr-custom?hello=world"));
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("hello world world");
	});

	it("CUSTOM HANDLER CAN SET RESPONSE STATUS", async () => {
		new TC.StaticRoute("/sr-custom-status", f("sample.txt"), (c, content) => {
			c.res.status = 202;
			return content;
		});
		const res = await s.handle(req("/sr-custom-status"));
		expect(res.status).toBe(202);
	});

	// ─── unknown extension ────────────────────────────────────────

	it("UNKNOWN EXTENSION FALLS BACK TO OCTET STREAM", async () => {
		// manually test mime fallback via a route pointing to a fake extension
		new TC.StaticRoute("/sr-bin", f("sample.what"));
		const res = await s.handle(req("/sr-bin"));
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
	});

	it("USING EXTENDED ABSTRACT METHOD", async () => {
		const path = "/sr-extended";

		class MyRoute extends TC.StaticRouteAbstract {
			constructor() {
				super();
				this.register();
			}

			override endpoint: string = path;
			override method: TC.Method = "GET";
			override filePath: string = f("sample.txt");
			override disposition?: "attachment" | "inline" | undefined;
			override cache?: CacheControlDirectiveInterface | undefined;
			override callback?: TC.StaticRouteCallback | undefined = () => "";
		}

		new MyRoute();
		const res = await s.handle(req(path));
		expect(res.status).toBe(200);
	});
});

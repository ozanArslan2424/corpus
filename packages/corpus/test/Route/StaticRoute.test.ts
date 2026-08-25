import { describe, expect, it } from "bun:test";
import path from "path";

import { TC, TX } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { req } from "../utils/req";

const s = createTestServer();
const f = (file: string) => path.resolve("test", "fixtures", file);

async function testContentType(file: string, contentType: string, contentSnippet: string) {
	const r = new TC.StaticRoute(`/${file}/${contentType}`, f(file));
	const res = await s.handle(r.request({}));
	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe(contentType);
	const body = await res.text();
	expect(body).toContain(contentSnippet);
}

describe("StaticRoute", () => {
	it("constructor", () => {
		const model = { response: undefined };
		const route = new TC.StaticRoute("POST /sr1", f("sample.html"), undefined, model);
		expect(route.variant).toBe("static");
		expect(route.method).toBe("POST");
		expect(route.endpoint).toBe("/sr1");
		expect(route.id).toBe("POST /sr1");
		expect(route.model).toBe(model);
	});

	it("returns 404 when file does not exist", async () => {
		new TC.StaticRoute("/sr-missing", f("does-not-exist.html"));
		const res = await s.handle(req("/sr-missing"));
		expect(res.status).toBe(404);
	});

	it("custom static route is also available through C.Route and X.File.bunFile", async () => {
		const content = new TX.File(f("sample.txt")).bunFile;
		const r = new TC.Route("/natively-handled", () => new TC.Res(content));
		const res = await s.handle(r.request({}));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toInclude("text/plain");
		const body = await res.text();
		expect(body).toContain("hello world");
	});

	describe("mime types and content", async () => {
		it("sets content type header", async () => {
			await testContentType("sample.html", "text/html", "<h1>Hello</h1>");
			await testContentType("sample.css", "text/css", "font-family");
			await testContentType("sample.js", "text/javascript", "hello");
			await testContentType("sample.txt", "text/plain", "hello world");
			await testContentType("sample.json", "application/json", "world");
			await testContentType(
				"sample.what",
				"application/octet-stream",
				"akshdjashdhasjdhjashdjhasjhdjah",
			);
		});

		it("sets content length header", async () => {
			new TC.StaticRoute("/sr-content-length", f("sample.txt"));
			const res = await s.handle(req("/sr-content-length"));
			const contentLength = res.headers.get("Content-Length");
			expect(contentLength).not.toBeNull();
			expect(Number(contentLength)).toBeGreaterThan(0);
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
	});

	describe("custom handler", () => {
		it("receives content and can modify it", async () => {
			const r = new TC.StaticRoute("/sr-custom", f("sample.txt"), (c, content) => {
				// trim for trailing \n
				return content.trim() + " " + (c.search as any).hello;
			});
			const res = await s.handle(r.request({ search: { hello: "world" } }));
			expect(res.status).toBe(200);
			const body = await res.text();
			expect(body).toContain("hello world world");
		});

		it("can set response status", async () => {
			const r = new TC.StaticRoute("/sr-custom-status", f("sample.txt"), (c, content) => {
				c.res.status = 202;
				return content;
			});
			const res = await s.handle(r.request({}));
			expect(res.status).toBe(202);
		});
	});
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Context } from "@/Context";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { Method } from "@/Request";
import { Status } from "@/Res";
import { RouteVariant } from "@/RouteBase";
import { StaticRoute } from "@/RouteBase/StaticRoute";

let dir: string;
let filePath: string;

beforeEach(() => {
	// StaticRoute.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "static-route-test-"));
	filePath = path.join(dir, "page.html");
	fs.writeFileSync(filePath, "<html>static</html>");
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

function makeContext(pathname: string = "/page") {
	return new Context<never, never, never, never>(
		new Request(`http://localhost${pathname}`),
		undefined,
	);
}

/** Wraps a thunk so both a synchronous throw and a rejected promise are caught uniformly. */
async function captureError(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (err) {
		return err;
	}
	throw new Error("expected the call to throw or reject, but it resolved");
}

describe("StaticRoute", () => {
	describe("direct construction", () => {
		it("resolves endpoint and method from the address", () => {
			const route = new StaticRoute("/page", filePath);
			expect(route.endpoint).toBe("/page");
			expect(route.method).toBe(Method.GET);
		});

		it("resolves method from a 'METHOD endpoint' address", () => {
			const route = new StaticRoute("POST /page", filePath);
			expect(route.method).toBe(Method.POST);
		});

		it("reads the file's bytes eagerly when it exists", () => {
			const route = new StaticRoute("/page", filePath);
			expect(route.bytes).not.toBeNull();
			expect(Buffer.from(route.bytes as Uint8Array).toString()).toBe("<html>static</html>");
		});

		it("leaves bytes null when the file does not exist yet", () => {
			const route = new StaticRoute("/missing", path.join(dir, "missing.html"));
			expect(route.bytes).toBeNull();
		});

		it("still creates an XFile instance even when the file does not exist", () => {
			const route = new StaticRoute("/missing", path.join(dir, "missing.html"));
			expect(route.file).not.toBeNull();
		});

		it("stores the callback when provided", () => {
			const callback = () => "custom";
			const route = new StaticRoute("/page", filePath, callback);
			expect(route.callback).toBe(callback);
		});

		it("leaves callback undefined when not provided", () => {
			const route = new StaticRoute("/page", filePath);
			expect(route.callback).toBeUndefined();
		});

		it("uses the default cache-control header when no cache config is given", () => {
			const route = new StaticRoute("/page", filePath);
			expect(route.cacheHeader).toContain("public");
			expect(route.cacheHeader).toContain("max-age=3600");
		});

		it("uses a custom cache-control header when config.cache is given", () => {
			const route = new StaticRoute("/page", filePath, undefined, {
				cache: { public: true, maxAge: 60 },
			});
			expect(route.cacheHeader).toContain("max-age=60");
		});

		it("strips cache out of the stored config, keeping the rest", () => {
			const route = new StaticRoute("/page", filePath, undefined, {
				cache: { public: true, maxAge: 60 },
				maxRequestBodySize: 1024,
			});
			expect(route.config).toEqual({ maxRequestBodySize: 1024 });
			expect(route.config).not.toHaveProperty("cache");
		});

		it("has variant 'static'", () => {
			const route = new StaticRoute("/page", filePath);
			expect(route.variant).toBe(RouteVariant.static);
		});

		it("registers itself onto the nearest App", () => {
			const app = new App();
			const route = new StaticRoute("/page", filePath);
			expect(app.routes).toContain(route);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new StaticRoute()).toThrow();
		});

		it("throws when constructed with only an address", () => {
			// @ts-expect-error - exercising the runtime guard for a missing filePath
			expect(() => new StaticRoute("/page")).toThrow();
		});
	});

	describe("handler: file present, no callback", () => {
		it("returns the file's raw bytes", async () => {
			const route = new StaticRoute("/page", filePath);
			const result = await route.handler(makeContext());
			expect(Buffer.from(result as Uint8Array).toString()).toBe("<html>static</html>");
		});

		it("sets content-type, cache-control, and content-length headers", async () => {
			const route = new StaticRoute("/page", filePath);
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBe("text/html");
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("max-age=3600");
			expect(ctx.res.headers.get(HeaderKey.ContentLength)).toBe(
				Buffer.byteLength("<html>static</html>").toString(),
			);
		});
	});

	describe("handler: file present, with callback", () => {
		it("calls the callback with the decoded file content and returns its result", async () => {
			const route = new StaticRoute(
				"/page",
				filePath,
				async (_c, content) => `wrapped: ${content}`,
			);
			const result = await route.handler(makeContext());
			expect(result).toBe("wrapped: <html>static</html>");
		});

		it("still sets headers before invoking the callback", async () => {
			const route = new StaticRoute("/page", filePath, async () => "ignored");
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBe("text/html");
		});
	});

	describe("handler: file missing", () => {
		it("throws a 404 Exception by default when bytes were never loaded", async () => {
			const route = new StaticRoute("/missing", path.join(dir, "missing.html"));
			const error = await captureError(() => route.handler(makeContext("/missing")));
			expect(error).toBeInstanceOf(Exception);
			expect((error as Exception).status).toBe(Status.NOT_FOUND);
		});

		it("throws via onFileNotFound when file is manually nulled out", async () => {
			const route = new StaticRoute("/page", filePath);
			route.file = null;
			const error = await captureError(() => route.handler(makeContext()));
			expect(error).toBeInstanceOf(Exception);
		});

		it("throws via onFileNotFound when bytes are manually nulled out", async () => {
			const route = new StaticRoute("/page", filePath);
			route.bytes = null;
			const error = await captureError(() => route.handler(makeContext()));
			expect(error).toBeInstanceOf(Exception);
		});

		it("allows overriding onFileNotFound", async () => {
			const route = new StaticRoute("/missing", path.join(dir, "missing.html"));
			route.onFileNotFound = async () => "custom not found";
			const result = await route.handler(makeContext("/missing"));
			expect(result).toBe("custom not found");
		});
	});
});

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { App } from "@/App";
import { Context } from "@/Context";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { Method } from "@/Request";
import type { Res } from "@/Res";
import { RouteVariant } from "@/RouteBase";
import { BundleRoute } from "@/RouteBase/BundleRoute";

let dir: string;

beforeEach(() => {
	// BundleRoute.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-route-test-"));
	fs.writeFileSync(path.join(dir, "index.html"), "<html>index</html>");
	fs.writeFileSync(path.join(dir, "favicon.ico"), "ico-bytes");
	fs.mkdirSync(path.join(dir, "assets"));
	fs.writeFileSync(path.join(dir, "assets", "main.js"), "console.log(1)");
	fs.mkdirSync(path.join(dir, "sub"));
	fs.writeFileSync(path.join(dir, "sub", "page.html"), "<html>sub page</html>");
});

afterEach(() => {
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

function makeContext(pathname: string) {
	return new Context<never, never, never, never>(
		new Request(`http://localhost${pathname}`),
		undefined,
	);
}

async function readBody(
	data: ReadableStream<Uint8Array> | Uint8Array | string | Res,
): Promise<string> {
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) return Buffer.from(data).toString();
	const chunks: Uint8Array[] = [];
	for await (const chunk of data as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
	return Buffer.concat(chunks).toString();
}

async function captureError(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (err) {
		return err;
	}
	throw new Error("expected the promise to reject, but it resolved");
}

describe("BundleRoute", () => {
	describe("direct construction", () => {
		it("sets endpoint, dir, method and variant", () => {
			const route = new BundleRoute("/app/*", dir);
			expect(route.endpoint).toBe("/app/*");
			expect(route.dir).toBe(dir);
			expect(route.method).toBe(Method.GET);
			expect(route.variant).toBe(RouteVariant.bundle);
		});

		it("uses the default definition when none is provided", () => {
			const route = new BundleRoute("/app/*", dir);
			expect(route.indexHtmlPath).toBe("index.html");
			expect(route.assetsDirPath).toBe("assets");
		});

		it("uses a custom definition when provided", () => {
			const route = new BundleRoute("/app/*", dir, {
				indexHtml: { path: "main.html" },
				assetsDir: { path: "static" },
			});
			expect(route.indexHtmlPath).toBe("main.html");
			expect(route.assetsDirPath).toBe("static");
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new BundleRoute()).toThrow();
		});

		it("throws when constructed with only an endpoint", () => {
			// @ts-expect-error - exercising the runtime guard for a missing dir
			expect(() => new BundleRoute("/app/*")).toThrow();
		});

		it("leaves config undefined", () => {
			const route = new BundleRoute("/app/*", dir);
			expect(route.config).toBeUndefined();
		});

		it("defaults ignore to an empty array", () => {
			const route = new BundleRoute("/app/*", dir);
			expect(route.ignore).toEqual([]);
		});
	});

	describe("handler: serving files", () => {
		it("serves index.html at the root path", async () => {
			const route = new BundleRoute("/*", dir);
			const result = await route.handler(makeContext("/"));
			expect(await readBody(result)).toBe("<html>index</html>");
		});

		it("serves a nested asset file directly", async () => {
			const route = new BundleRoute("/*", dir);
			const result = await route.handler(makeContext("/assets/main.js"));
			expect(await readBody(result)).toBe("console.log(1)");
		});

		it("strips a prefixed endpoint before resolving the file", async () => {
			const route = new BundleRoute("/app/*", dir);
			const result = await route.handler(makeContext("/app/assets/main.js"));
			expect(await readBody(result)).toBe("console.log(1)");
		});

		it("treats a non-slash-prefixed wildcard endpoint the same as a slash-prefixed one", async () => {
			const route = new BundleRoute("/app*", dir);
			const result = await route.handler(makeContext("/app/assets/main.js"));
			expect(await readBody(result)).toBe("console.log(1)");
		});

		it("serves a nested html file directly", async () => {
			const route = new BundleRoute("/*", dir);
			const result = await route.handler(makeContext("/sub/page.html"));
			expect(await readBody(result)).toBe("<html>sub page</html>");
		});

		it("falls back to index.html for a missing non-html path (SPA routing)", async () => {
			const route = new BundleRoute("/*", dir);
			const result = await route.handler(makeContext("/some/client/route"));
			expect(await readBody(result)).toBe("<html>index</html>");
		});

		it("does not fall back to index.html for a missing .html path", async () => {
			const route = new BundleRoute("/*", dir);
			const error = await captureError(() => route.handler(makeContext("/missing.html")));
			expect(error).toBeInstanceOf(Exception);
		});
	});

	describe("handler: headers", () => {
		it("sets content-type, cache-control and content-length for html files", async () => {
			const route = new BundleRoute("/*", dir);
			const ctx = makeContext("/");
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBe("text/html");
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("no-cache");
			expect(ctx.res.headers.get(HeaderKey.ContentLength)).toBe(
				Buffer.byteLength("<html>index</html>").toString(),
			);
		});

		it("sets content-disposition and long-lived cache-control for asset files", async () => {
			const route = new BundleRoute("/*", dir);
			const ctx = makeContext("/assets/main.js");
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toContain("javascript");
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("immutable");
			expect(ctx.res.headers.get(HeaderKey.ContentDisposition)).toContain("main.js");
		});

		it("uses the fallback cache definition for root files outside assets/index", async () => {
			const route = new BundleRoute("/*", dir, {
				indexHtml: { path: "index.html" },
				assetsDir: { path: "assets" },
				fallback: { public: true, maxAge: 60 },
			});
			const ctx = makeContext("/favicon.ico");
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("max-age=60");
		});
	});

	describe("ignore patterns", () => {
		it("serves index.html instead of an exactly-matched ignored path", async () => {
			const route = new BundleRoute("/*", dir);
			route.ignore = ["favicon.ico"];
			const result = await route.handler(makeContext("/favicon.ico"));
			expect(await readBody(result)).toBe("<html>index</html>");
		});

		it("serves index.html for paths matching a wildcard ignore pattern", async () => {
			const route = new BundleRoute("/*", dir);
			route.ignore = ["sub/*"];
			const result = await route.handler(makeContext("/sub/page.html"));
			expect(await readBody(result)).toBe("<html>index</html>");
		});

		it("does not affect paths that don't match an ignore pattern", async () => {
			const route = new BundleRoute("/*", dir);
			route.ignore = ["favicon.ico"];
			const result = await route.handler(makeContext("/assets/main.js"));
			expect(await readBody(result)).toBe("console.log(1)");
		});
	});

	describe("path traversal protection", () => {
		it("flags a path outside the bundle directory as a traversal attempt", () => {
			const route = new BundleRoute("/*", dir) as any;
			expect(route.isTraversalAttempt("/etc/passwd")).toBe(true);
		});

		it("does not flag the bundle directory root itself", () => {
			const route = new BundleRoute("/*", dir) as any;
			expect(route.isTraversalAttempt(dir)).toBe(false);
		});

		it("does not flag a path inside the bundle directory", () => {
			const route = new BundleRoute("/*", dir) as any;
			expect(route.isTraversalAttempt(path.join(dir, "assets", "main.js"))).toBe(false);
		});

		it("flags a sibling directory that merely shares a name prefix with the bundle dir", () => {
			// e.g. dir = "/tmp/foo", sibling = "/tmp/foo-evil" - a naive startsWith(root)
			// check without the trailing separator would wrongly allow this
			const route = new BundleRoute("/*", dir) as any;
			expect(route.isTraversalAttempt(`${dir}-evil/secret.txt`)).toBe(true);
		});

		it("refuses to serve a file when the resolved target escapes the bundle directory", async () => {
			const route = new BundleRoute("/*", dir);
			(route as any).resolveTargetPath = mock(() => "/etc/passwd");

			const error = await captureError(() => route.handler(makeContext("/anything")));
			expect(error).toBeInstanceOf(Exception);
		});
	});

	describe("onFileNotFound", () => {
		it("throws a 404 Exception by default", async () => {
			const route = new BundleRoute("/*", dir);
			const error = await captureError(() => route.handler(makeContext("/missing.html")));
			expect(error).toBeInstanceOf(Exception);
			expect((error as Error).message).toBe("/missing.html file was not found.");
		});

		it("is called with the resolved sub-path", async () => {
			const route = new BundleRoute("/app/*", dir);
			const onFileNotFound = mock(async () => "custom not found");
			route.onFileNotFound = onFileNotFound;

			await route.handler(makeContext("/app/missing.html"));

			expect(onFileNotFound).toHaveBeenCalledWith("/missing.html");
		});

		it("allows overriding the not-found response", async () => {
			const route = new BundleRoute("/*", dir);
			route.onFileNotFound = async () => "custom not found";
			const result = await route.handler(makeContext("/missing.html"));
			expect(result).toBe("custom not found");
		});

		it("is invoked with the resolved sub-path on a traversal attempt", async () => {
			const route = new BundleRoute("/app/*", dir);
			(route as any).resolveTargetPath = mock(() => "/etc/passwd");
			const onFileNotFound = mock(async () => "blocked");
			route.onFileNotFound = onFileNotFound;

			await route.handler(makeContext("/app/anything"));

			expect(onFileNotFound).toHaveBeenCalledWith("/anything");
		});
	});
});

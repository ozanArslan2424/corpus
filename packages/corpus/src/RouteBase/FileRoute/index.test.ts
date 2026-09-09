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
import { FileRoute } from "@/RouteBase/FileRoute";

let dir: string;
let filePath: string;

beforeEach(() => {
	// FileRoute.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();

	dir = fs.mkdtempSync(path.join(os.tmpdir(), "file-route-test-"));
	filePath = path.join(dir, "report.pdf");
	fs.writeFileSync(filePath, "pdf content");
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
	Globals.delete("apps");
});

function makeContext(pathname: string = "/report.pdf") {
	return new Context<never, never, never, never>(
		new Request(`http://localhost${pathname}`),
		undefined,
	);
}

async function readBody(data: ReadableStream<Uint8Array> | Uint8Array | string): Promise<string> {
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) return Buffer.from(data).toString();
	const chunks: Uint8Array[] = [];
	for await (const chunk of data as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
	return Buffer.concat(chunks).toString();
}

/** Wraps a thunk so both a synchronous throw and a rejected promise are caught uniformly. */
async function captureError(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (err) {
		return err;
	}
	throw new Error("expected the promise to reject, but it resolved");
}

describe("FileRoute", () => {
	describe("direct construction", () => {
		it("resolves endpoint and method from a string address", () => {
			const route = new FileRoute("/report.pdf", filePath);
			expect(route.endpoint).toBe("/report.pdf");
			expect(route.method).toBe(Method.GET);
		});

		it("resolves method from a 'METHOD endpoint' address", () => {
			const route = new FileRoute("POST /report.pdf", filePath);
			expect(route.method).toBe(Method.POST);
			expect(route.endpoint).toBe("/report.pdf");
		});

		it("accepts a plain string definition as the file path", () => {
			const route = new FileRoute("/report.pdf", filePath);
			expect(route.filePath).toBe(filePath);
		});

		it("accepts an object definition with filePath", () => {
			const route = new FileRoute("/report.pdf", { filePath });
			expect(route.filePath).toBe(filePath);
		});

		it("sets disposition from an object definition when provided", () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "attachment" });
			expect(route.disposition).toBe("attachment");
		});

		it("leaves disposition undefined when not provided", () => {
			const route = new FileRoute("/report.pdf", { filePath });
			expect(route.disposition).toBeUndefined();
		});

		it("sets cache from an object definition when provided", () => {
			const custom = { public: false, maxAge: 10 };
			const route = new FileRoute("/report.pdf", { filePath, cache: custom });
			expect(route.cache).toBe(custom);
		});

		it("defaults cache when not provided", () => {
			const route = new FileRoute("/report.pdf", { filePath });
			expect(route.cache).toEqual({ public: true, maxAge: 3600, noCache: false });
		});

		it("has variant 'file'", () => {
			const route = new FileRoute("/report.pdf", filePath);
			expect(route.variant).toBe(RouteVariant.file);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new FileRoute()).toThrow();
		});

		it("throws when constructed with only an address", () => {
			// @ts-expect-error - exercising the runtime guard for a missing definition
			expect(() => new FileRoute("/report.pdf")).toThrow();
		});

		it("leaves config undefined", () => {
			const route = new FileRoute("/report.pdf", filePath);
			expect(route.config).toBeUndefined();
		});
	});

	describe("handler: file exists, no disposition", () => {
		it("returns the file's bytes", async () => {
			const route = new FileRoute("/report.pdf", filePath);
			const result = await route.handler(makeContext());
			expect(await readBody(result)).toBe("pdf content");
		});

		it("sets content-type, cache-control and content-length headers", async () => {
			const route = new FileRoute("/report.pdf", filePath);
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBe("application/pdf");
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("max-age=3600");
			expect(ctx.res.headers.get(HeaderKey.ContentLength)).toBe(
				Buffer.byteLength("pdf content").toString(),
			);
		});

		it("does not set a content-disposition header", async () => {
			const route = new FileRoute("/report.pdf", filePath);
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentDisposition)).toBeNull();
		});

		it("uses a custom cache definition when provided", async () => {
			const route = new FileRoute("/report.pdf", { filePath, cache: { public: true, maxAge: 60 } });
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("max-age=60");
		});
	});

	describe("handler: file exists, with disposition", () => {
		it("returns a stream instead of raw bytes", async () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "attachment" });
			const result = await route.handler(makeContext());
			expect(result).toBeInstanceOf(ReadableStream);
			expect(await readBody(result)).toBe("pdf content");
		});

		it("sets content-type and cache-control headers", async () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "attachment" });
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBe("application/pdf");
			expect(ctx.res.headers.get(HeaderKey.CacheControl)).toContain("max-age=3600");
		});

		it("sets content-disposition with the resolved filename", async () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "attachment" });
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentDisposition)).toContain("attachment");
			expect(ctx.res.headers.get(HeaderKey.ContentDisposition)).toContain("report.pdf");
		});

		it("does not set a content-length header", async () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "attachment" });
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentLength)).toBeNull();
		});

		it("uses 'inline' disposition when specified", async () => {
			const route = new FileRoute("/report.pdf", { filePath, disposition: "inline" });
			const ctx = makeContext();
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentDisposition)).toContain("inline");
		});
	});

	describe("handler: file does not exist", () => {
		it("throws a 404 Exception by default", async () => {
			const route = new FileRoute("/missing.pdf", path.join(dir, "missing.pdf"));
			const error = await captureError(() => route.handler(makeContext("/missing.pdf")));
			expect(error).toBeInstanceOf(Exception);
			expect((error as Exception).status).toBe(Status.NOT_FOUND);
		});

		it("allows overriding onFileNotFound", async () => {
			const route = new FileRoute("/missing.pdf", path.join(dir, "missing.pdf"));
			route.onFileNotFound = async () => "custom not found";
			const result = await route.handler(makeContext("/missing.pdf"));
			expect(result).toBe("custom not found");
		});

		it("does not set any response headers when the file is missing", async () => {
			const route = new FileRoute("/missing.pdf", path.join(dir, "missing.pdf"));
			route.onFileNotFound = async () => "custom not found";
			const ctx = makeContext("/missing.pdf");
			await route.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.ContentType)).toBeNull();
		});
	});
});

import { afterEach, describe, expect, it } from "bun:test";

import { CacheControlDirective } from "@/C/CacheControlDirective/CacheControlDirective";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());

describe("CacheControlDirective", () => {
	describe("createHeaderString", () => {
		it("SERIALIZES PUBLIC", () => {
			expect(CacheControlDirective.createHeaderString({ public: true })).toBe("public");
		});

		it("SERIALIZES MAX AGE", () => {
			expect(CacheControlDirective.createHeaderString({ maxAge: 3600 })).toBe("max-age=3600");
		});

		it("SERIALIZES MAX AGE ZERO", () => {
			expect(CacheControlDirective.createHeaderString({ maxAge: 0 })).toBe("max-age=0");
		});

		it("SERIALIZES IMMUTABLE", () => {
			expect(CacheControlDirective.createHeaderString({ immutable: true })).toBe("immutable");
		});

		it("SERIALIZES COMBINATION IN ORDER", () => {
			expect(
				CacheControlDirective.createHeaderString({
					immutable: true,
					maxAge: 31536000,
					public: true,
				}),
			).toBe("public, max-age=31536000, immutable");
		});

		it("NO STORE SHORT CIRCUITS EVERYTHING", () => {
			expect(
				CacheControlDirective.createHeaderString({
					noStore: true,
					noCache: true,
					public: true,
					maxAge: 3600,
					immutable: true,
				}),
			).toBe("no-store");
		});

		it("NO CACHE SHORT CIRCUITS THE REST", () => {
			expect(
				CacheControlDirective.createHeaderString({
					noCache: true,
					public: true,
					maxAge: 3600,
					immutable: true,
				}),
			).toBe("no-cache");
		});

		it("FALSE FLAGS ARE NOT SERIALIZED", () => {
			expect(
				CacheControlDirective.createHeaderString({
					public: false,
					immutable: false,
					noCache: false,
					noStore: false,
					maxAge: 60,
				}),
			).toBe("max-age=60");
		});

		it("EMPTY DIRECTIVE SERIALIZES TO EMPTY STRING", () => {
			expect(CacheControlDirective.createHeaderString({})).toBe("");
		});
	});

	describe("applyHeader", () => {
		it("SETS THE CACHE CONTROL HEADER", () => {
			const headers = new Headers();
			CacheControlDirective.applyHeader(headers, { public: true, maxAge: 3600 });

			expect(headers.get("cache-control")).toBe("public, max-age=3600");
		});

		it("RETURNS THE SAME HEADERS INSTANCE", () => {
			const headers = new Headers();
			const returned = CacheControlDirective.applyHeader(headers, { noCache: true });

			expect(returned).toBe(headers);
		});

		it("OVERWRITES AN EXISTING HEADER", () => {
			const headers = new Headers({ "cache-control": "no-store" });
			CacheControlDirective.applyHeader(headers, { public: true, maxAge: 60 });

			expect(headers.get("cache-control")).toBe("public, max-age=60");
		});
	});

	describe("constructor", () => {
		it("ASSIGNS OPTS TO THE INSTANCE", () => {
			const directive = new CacheControlDirective({ public: true, maxAge: 3600 });

			expect(directive.public).toBe(true);
			expect(directive.maxAge).toBe(3600);
			expect(directive.immutable).toBeUndefined();
		});

		it("INSTANCE WORKS WITH createHeaderString", () => {
			const directive = new CacheControlDirective({ public: true, maxAge: 3600 });

			expect(CacheControlDirective.createHeaderString(directive)).toBe("public, max-age=3600");
		});
	});
});

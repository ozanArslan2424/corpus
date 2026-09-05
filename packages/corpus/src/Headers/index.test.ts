import { beforeAll, describe, expect, it } from "bun:test";

import {
	createCacheControlHeader,
	createContentDispositionHeader,
	HeaderKey,
	patchGlobalHeaders,
	readHeader,
} from "@/Headers";

// patchGlobalHeaders() mutates globalThis.Headers for the entire process and is
// NOT idempotent (each call re-wraps whatever Headers currently is) - call it
// exactly once here, same caveat as patchGlobalRequest.
beforeAll(() => {
	patchGlobalHeaders();
});

describe("createCacheControlHeader", () => {
	it("returns 'no-store' when noStore is true, ignoring all other fields", () => {
		expect(createCacheControlHeader({ noStore: true, public: true, maxAge: 60 })).toBe("no-store");
	});

	it("returns 'no-cache' when noCache is true and noStore is not set", () => {
		expect(createCacheControlHeader({ noCache: true, public: true })).toBe("no-cache");
	});

	it("prioritizes noStore over noCache when both are true", () => {
		expect(createCacheControlHeader({ noStore: true, noCache: true })).toBe("no-store");
	});

	it("returns an empty string for an empty definition", () => {
		expect(createCacheControlHeader({})).toBe("");
	});

	it("includes 'public' when public is true", () => {
		expect(createCacheControlHeader({ public: true })).toBe("public");
	});

	it("includes max-age when maxAge is set, even to 0", () => {
		expect(createCacheControlHeader({ maxAge: 0 })).toBe("max-age=0");
	});

	it("includes 'immutable' when immutable is true", () => {
		expect(createCacheControlHeader({ immutable: true })).toBe("immutable");
	});

	it("joins multiple directives with ', ' in declaration order", () => {
		expect(createCacheControlHeader({ public: true, maxAge: 3600, immutable: true })).toBe(
			"public, max-age=3600, immutable",
		);
	});

	it("omits public/immutable when they are false", () => {
		expect(createCacheControlHeader({ public: false, maxAge: 60, immutable: false })).toBe(
			"max-age=60",
		);
	});
});

describe("createContentDispositionHeader", () => {
	it("returns just the disposition when no filename is given", () => {
		expect(createContentDispositionHeader({ disposition: "attachment" })).toBe("attachment");
	});

	it("returns 'inline' with no filename", () => {
		expect(createContentDispositionHeader({ disposition: "inline" })).toBe("inline");
	});

	it("includes a quoted filename when provided", () => {
		expect(
			createContentDispositionHeader({ disposition: "attachment", filename: "report.pdf" }),
		).toBe('attachment; filename="report.pdf"');
	});
});

describe("readHeader", () => {
	it("returns null when headers is undefined", () => {
		expect(readHeader(undefined, HeaderKey.ContentType)).toBeNull();
	});

	describe("with a Headers instance", () => {
		it("reads a matching header", () => {
			const headers = new Headers({ "Content-Type": "application/json" });
			expect(readHeader(headers, HeaderKey.ContentType)).toBe("application/json");
		});

		it("returns null when there is no match", () => {
			const headers = new Headers();
			expect(readHeader(headers, HeaderKey.ContentType)).toBeNull();
		});
	});

	describe("with an array of pairs", () => {
		it("matches case-insensitively", () => {
			const headers: [string, string][] = [["content-type", "text/plain"]];
			expect(readHeader(headers, HeaderKey.ContentType)).toBe("text/plain");
		});

		it("returns null when there is no match", () => {
			const headers: [string, string][] = [["x-other", "value"]];
			expect(readHeader(headers, HeaderKey.ContentType)).toBeNull();
		});
	});

	describe("with a plain object", () => {
		it("matches case-insensitively", () => {
			const headers = { "content-type": "text/html" };
			expect(readHeader(headers, HeaderKey.ContentType)).toBe("text/html");
		});

		it("returns null when there is no match", () => {
			expect(readHeader({ "x-other": "value" }, HeaderKey.ContentType)).toBeNull();
		});

		it("returns null when the matched key's value is undefined", () => {
			const headers = { "content-type": undefined } as unknown as Record<string, string>;
			expect(readHeader(headers, HeaderKey.ContentType)).toBeNull();
		});
	});
});

describe("patchGlobalHeaders", () => {
	describe("get", () => {
		it("is case-insensitive", () => {
			const headers = new Headers();
			headers.set("One", "testing");
			expect(headers.get("One")).toBe(headers.get("one"));
		});
	});

	describe("set", () => {
		it("accepts string | number | boolean values", () => {
			const headers = new Headers();
			headers.set("one", 1);
			headers.set("true", true);
			expect(headers.get("one")).toBe("1");
			expect(headers.get("true")).toBe("true");
		});
	});

	describe("setMany", () => {
		it("sets values from a plain object", () => {
			const headers = new Headers();
			headers.setMany({ "X-A": "1", "X-B": "2" });
			expect(headers.get("X-A")).toBe("1");
			expect(headers.get("X-B")).toBe("2");
		});

		it("skips empty or whitespace-only values from a plain object", () => {
			const headers = new Headers();
			headers.setMany({ "X-Empty": "", "X-Blank": "   ", "X-Real": "value" });
			expect(headers.has("X-Empty")).toBe(false);
			expect(headers.has("X-Blank")).toBe(false);
			expect(headers.get("X-Real")).toBe("value");
		});

		it("overwrites rather than accumulates duplicate keys from a plain array of pairs", () => {
			const headers = new Headers();
			headers.setMany([
				["X-A", "1"],
				["X-A", "2"],
			]);
			expect(headers.get("X-A")).toBe("2");
		});

		it("skips empty values from an array of pairs", () => {
			const headers = new Headers();
			headers.setMany([["X-Empty", ""]]);
			expect(headers.has("X-Empty")).toBe(false);
		});

		it("appends (not overwrites) Set-Cookie entries when copying from a Headers instance", () => {
			const source = new Headers();
			source.append("Set-Cookie", "a=1");
			source.append("Set-Cookie", "b=2");
			const target = new Headers();
			target.setMany(source);
			const result = target.get("Set-Cookie") ?? "";
			expect(result).toContain("a=1");
			expect(result).toContain("b=2");
		});

		it("uses set (not append) for non-Set-Cookie headers when copying from a Headers instance", () => {
			const source = new Headers({ "X-A": "1" });
			const target = new Headers({ "X-A": "existing" });
			target.setMany(source);
			expect(target.get("X-A")).toBe("1");
		});
	});

	describe("setCacheControl", () => {
		it("sets the Cache-Control header from a definition", () => {
			const headers = new Headers();
			headers.setCacheControl({ public: true, maxAge: 60 });
			expect(headers.get(HeaderKey.CacheControl)).toBe("public, max-age=60");
		});
	});

	describe("setContentDisposition", () => {
		it("sets the Content-Disposition header from a definition", () => {
			const headers = new Headers();
			headers.setContentDisposition({ disposition: "attachment", filename: "file.txt" });
			expect(headers.get(HeaderKey.ContentDisposition)).toBe('attachment; filename="file.txt"');
		});
	});
});

import { describe, it, expect } from "bun:test";

import { URLParamsParser } from "@/Parser/URLParamsParser";

describe("URLParamsParser", () => {
	const parser = new URLParamsParser();

	describe("toObject", () => {
		it("returns an empty object for no params", () => {
			expect(parser.parse({})).toEqual({});
		});

		it("passes through plain string values", () => {
			expect(parser.parse({ slug: "hello" })).toEqual({ slug: "hello" });
		});

		it("decodes percent-encoded values", () => {
			expect(parser.parse({ name: "John%20Doe" })).toEqual({ name: "John Doe" });
		});

		it("decodes unicode escapes", () => {
			expect(parser.parse({ emoji: "%F0%9F%91%8B" })).toEqual({ emoji: "👋" });
		});

		it("decodes multiple params independently", () => {
			expect(parser.parse({ a: "one%20two", b: "three%2Ffour" })).toEqual({
				a: "one two",
				b: "three/four",
			});
		});

		it("throws URIError on malformed percent-encoding", () => {
			expect(() => parser.parse({ broken: "%ZZ" })).toThrow(URIError);
		});
	});

	describe("value coercion", () => {
		it("coerces digit strings to numbers", () => {
			expect(parser.parse({ id: "42" })).toEqual({ id: 42 });
		});

		it("coerces booleans", () => {
			expect(parser.parse({ active: "true", archived: "false" })).toEqual({
				active: true,
				archived: false,
			});
		});

		it("coerces null and JSON literals", () => {
			expect(parser.parse({ value: "null" })).toEqual({ value: null });
		});

		it("coerces JSON arrays and objects", () => {
			expect(parser.parse({ ids: "[1,2,3]", obj: '{"a":1}' })).toEqual({
				ids: [1, 2, 3],
				obj: { a: 1 },
			});
		});

		it("leaves non-JSON strings as strings", () => {
			expect(parser.parse({ slug: "hello-world" })).toEqual({ slug: "hello-world" });
		});

		it("coerces percent-encoded JSON after decoding", () => {
			expect(parser.parse({ ids: "%5B1%2C2%5D" })).toEqual({ ids: [1, 2] });
		});
	});
});

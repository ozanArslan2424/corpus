import { describe, expect, it } from "bun:test";

import { ParserBase } from "@/ParserBase";

// ParserBase is abstract with only protected members - a minimal concrete
// subclass is needed to exercise parseKey/tryParseJSON/newContainer directly.
class TestParser extends ParserBase<unknown> {
	parse(): Record<string, unknown> {
		return {};
	}

	// expose the protected methods for direct testing
	publicParseKey(key: string) {
		return this.parseKey(key);
	}
	publicTryParseJSON(value: string) {
		return this.tryParseJSON(value);
	}
	publicNewContainer(current: unknown) {
		return this.newContainer(current);
	}
}

describe("ParserBase", () => {
	const parser = new TestParser();

	describe("parseKey", () => {
		it("splits a plain key into a single-element array", () => {
			expect(parser.publicParseKey("name")).toEqual(["name"]);
		});

		it("splits dot notation into separate parts", () => {
			expect(parser.publicParseKey("user.name")).toEqual(["user", "name"]);
		});

		it("splits bracket notation into separate parts", () => {
			expect(parser.publicParseKey("user[name]")).toEqual(["user", "name"]);
		});

		it("converts numeric bracket segments into numbers", () => {
			expect(parser.publicParseKey("items[0]")).toEqual(["items", 0]);
		});

		it("handles mixed dot and bracket notation with numeric indices", () => {
			expect(parser.publicParseKey("a[0].b[1][c]")).toEqual(["a", 0, "b", 1, "c"]);
		});
	});

	describe("tryParseJSON", () => {
		it("parses a JSON number string into a number", () => {
			expect(parser.publicTryParseJSON("42")).toBe(42);
		});

		it("parses a JSON boolean string into a boolean", () => {
			expect(parser.publicTryParseJSON("true")).toBe(true);
		});

		it("parses a JSON object string into an object", () => {
			expect(parser.publicTryParseJSON('{"a":1}')).toEqual({ a: 1 });
		});

		it("returns the original string when it isn't valid JSON", () => {
			expect(parser.publicTryParseJSON("Ozan Bilgen")).toBe("Ozan Bilgen");
		});
	});

	describe("newContainer", () => {
		it("returns the same value it was given", () => {
			const obj = { a: 1 };
			expect(parser.publicNewContainer(obj)).toBe(obj);
		});
	});
});

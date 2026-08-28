import { describe, expect, it } from "bun:test";

import { ParserBase } from "@/X/ParserBase";

class TestParser extends ParserBase<unknown> {
	parse(input: unknown): Record<string, unknown> {
		return this.newContainer(input);
	}
	testParseKey(key: string) {
		return this.parseKey(key);
	}
	testTryParseJSON(value: string) {
		return this.tryParseJSON(value);
	}
}

describe("ObjectParserAbstract", () => {
	const parser = new TestParser();

	it("newContainer passes the value through as a record", () => {
		const input = { a: 1 };
		expect(parser.parse(input)).toBe(input);
	});

	it("parseKey splits bracket/dot notation into string and numeric parts", () => {
		expect(parser.testParseKey("a[0].b[1][c]")).toEqual(["a", 0, "b", 1, "c"]);
	});

	it("tryParseJSON parses valid JSON", () => {
		expect(parser.testTryParseJSON('{"a":1}')).toEqual({ a: 1 });
	});

	it("tryParseJSON returns the original string when parsing fails", () => {
		expect(parser.testTryParseJSON("not json")).toBe("not json");
	});
});

import { describe, expect, it } from "bun:test";

import { URLParamsParser } from "@/URLParamsParser";

describe("URLParamsParser", () => {
	const parser = new URLParamsParser();

	it("parses flat string values", () => {
		expect(parser.parse({ name: "Ozan" })).toEqual({ name: "Ozan" });
	});

	it("parses JSON-looking string values into their real types", () => {
		expect(
			parser.parse({
				age: "30",
				active: "true",
				meta: '{"a":1}',
			}),
		).toEqual({
			age: 30,
			active: true,
			meta: { a: 1 },
		});
	});

	it("leaves non-JSON strings as-is", () => {
		expect(parser.parse({ name: "Ozan Arslan" })).toEqual({ name: "Ozan Arslan" });
	});

	it("decodes percent-encoded values before parsing", () => {
		expect(parser.parse({ name: "Ozan%20Arslan" })).toEqual({ name: "Ozan Arslan" });
	});

	it("decodes percent-encoded JSON before parsing it", () => {
		expect(parser.parse({ meta: "%7B%22a%22%3A1%7D" })).toEqual({ meta: { a: 1 } });
	});

	it("does not treat keys as nested paths, unlike the other parsers", () => {
		expect(parser.parse({ "user.name": "Ozan", "items[0]": "a" })).toEqual({
			"user.name": "Ozan",
			"items[0]": "a",
		});
	});

	it("returns an empty object for empty input", () => {
		expect(parser.parse({})).toEqual({});
	});
});

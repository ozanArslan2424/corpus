import { describe, expect, it } from "bun:test";

import { type } from "arktype";

import { ArkSchemaPrinter } from "@/SchemaPrinter/ArkSchemaPrinter";

const p = new ArkSchemaPrinter();

describe("ArkSchemaPrinter - objects", () => {
	it("prints an object literal with sorted keys", () => {
		const t = type({ name: "string", age: "number" });
		expect(p.print(t, "in")).toBe("{ age: number; name: string }");
		expect(p.print(t, "out")).toBe("{ age: number; name: string }");
	});

	it("preserves optional key markers", () => {
		const t = type({ "name?": "string" });
		expect(p.print(t, "in")).toBe("{ name?: string }");
	});

	it("prints an empty object as {}", () => {
		const t = type({});
		expect(p.print(t, "in")).toBe("{}");
	});

	it("prints nested objects", () => {
		const t = type({ a: { b: { c: "string" } } });
		expect(p.print(t, "in")).toBe("{ a: { b: { c: string } } }");
	});

	it("rewrites an index signature key into TS syntax", () => {
		const t = type({ "[string]": "number" });
		expect(p.print(t, "in")).toBe("{ [key: string]: number }");
	});
});

describe("ArkSchemaPrinter - unions", () => {
	it("prints and sorts a union of structural types alphabetically", () => {
		const t = type("string|number");
		expect(p.print(t, "in")).toBe("number | string");
	});

	it("keeps a nested union inside an object prop", () => {
		const t = type({ a: "string", b: "number|string" });
		expect(p.print(t, "in")).toBe("{ a: string; b: number | string }");
	});

	it("sorts null to the end of a union", () => {
		const t = type({ a: "string|null" });
		expect(p.print(t, "in")).toBe("{ a: string | null }");
	});

	it("prints a union of string literals", () => {
		const t = type("'a'|'b'|1|2");
		expect(p.print(t, "in")).toBe('"a" | "b" | 1 | 2');
	});
});

describe("ArkSchemaPrinter - arrays", () => {
	it("leaves a top-level array-of-primitive suffix as-is", () => {
		const t = type("string[]");
		expect(p.print(t, "in")).toBe("string[]");
	});

	it("wraps an array-of-object into Array<...>", () => {
		const t = type([{ a: "string" }, "[]"]);
		expect(p.print(t, "in")).toBe("Array<{ a: string }>");
	});

	it("wraps an array of a parenthesized union into Array<(...)>", () => {
		const t = type("(string|number)[]");
		expect(p.print(t, "in")).toBe("Array<(number | string)>");
	});
});

describe("matching .in expressions correctly", () => {
	const schemas = [
		// plain, no constraint
		[type("string"), "string"], // i = 0
		[type("number"), "number"], // i = 1
		[type("boolean"), "boolean"], // i = 2
		[type("bigint"), "bigint"], // i = 3
		[type("Date"), "Date"], // i = 4
		[type("'admin' | 'user'"), '"admin" | "user"'], // i = 5 // arktype uses double quotes
		[type("string[]"), "string[]"], // i = 6

		// single-sided constraints
		[type("string >= 8"), "string"], // i = 7
		[type("string <= 500"), "string"], // i = 8
		[type("string == 2"), "string"], // i = 9
		[type("number > 0"), "number"], // i = 10
		[type("number.integer < 100"), "number"], // i = 11
		[type("number % 2"), "number"], // i = 12

		// two-sided (range) constraints
		[type("8 <= string <= 72"), "string"], // i = 13
		[type("0 < number < 10"), "number"], // i = 14

		// dot-suffixed keyword constraints
		[type("string.email"), "string"], // i = 15
		[type("string.uuid"), "string"], // i = 16
		[type("string.uuid.v4"), "string"], // i = 17
		[type("string.alpha"), "string"], // i = 18
		[type("string.alphanumeric"), "string"], // i = 19
		[type("string.digits"), "string"], // i = 20
		[type("string.creditCard"), "string"], // i = 21
		[type("string.ip"), "string"], // i = 22
		[type("string.ip.v4"), "string"], // i = 23
		[type("number.integer"), "number"], // i = 24

		// regex-backed / custom pattern
		[type("/@arktype\\.io$/"), "string"], // i = 25

		// intersected constraints
		[type("string.email & /@arktype\\.io$/"), "string"], // i = 26
		[type("string <= 20 & string.alpha"), "string"], // i = 27
		[type("number > 0 & number < 10"), "number"], // i = 28

		// morphs
		[type("string.numeric.parse"), "string"], // i = 29
		[type("string.date.iso.parse"), "string"], // i = 30
		[type("string.json.parse"), "string"], // i = 31

		// nested/object forms
		[
			type({ email: "string.email", score: "number.integer < 100" }),
			"{ email: string; score: number }",
		], // i = 32
		[type({ "bio?": "string <= 500" }), "{ bio?: string }"], // i = 33

		// constraint inside a union
		[type("string.email | null"), "string | null"], // i = 34
		[type("(string >= 8) | number"), "number | string"], // i = 35 // sorted alphabetically
	] as const;

	it.each(schemas)("resolves to %s", async (schema, expected) => {
		expect(p.print(schema, "in")).toBe(expected);
	});
});

describe("matching .out expressions correctly", () => {
	const schemas = [
		// morphs
		[type("string.numeric.parse"), "number"], // i = 29
		[type("string.date.iso.parse"), "Date"], // i = 30
		[
			type("string.json.parse"),
			"{ [key: string]: false | number | string | true | unknown | null }",
		], // i = 31
	] as const;

	it.each(schemas)("resolves to %s", async (schema, expected) => {
		expect(p.print(schema, "out")).toBe(expected);
	});
});

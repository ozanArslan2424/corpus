import { describe, expect, it } from "bun:test";

import { type } from "arktype";

import { ArkSchemaPrinter } from "@/schema/ArkSchemaPrinter";

const p = new ArkSchemaPrinter();

describe("ArkSchemaPrinter - primitives", () => {
	it("prints bare primitives unchanged", () => {
		expect(p.print(type("string"), "in")).toBe("string");
		expect(p.print(type("number"), "in")).toBe("number");
		expect(p.print(type("boolean"), "in")).toBe("boolean");
		expect(p.print(type("bigint"), "in")).toBe("bigint");
		expect(p.print(type("Date"), "in")).toBe("Date");
	});
});

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

describe("ArkSchemaPrinter - tuples", () => {
	it("prints a tuple using semicolon separators (current renderer behavior)", () => {
		const t = type(["string", "number"]);
		// NOTE: arktype's tuple expression uses `,`-separated members internally,
		// but rewriteGroup re-joins kept members with "; " like object props do,
		// so the printed tuple ends up semicolon-separated rather than comma-separated.
		expect(p.print(t, "in")).toBe("[number; string]");
	});
});

describe("ArkSchemaPrinter - morphs (in vs out)", () => {
	it("resolves .in and .out separately for a parsed-numeric morph", () => {
		const t = type("string.numeric.parse");
		// input side is the raw numeric-string regex/validator, not TS-expressible,
		// so it passes through unstripped (it's the sole intersection member)
		expect(p.print(t, "out")).toBe("number");
		expect(p.print(t, "in")).toMatch(/^\/.*\/$/); // a regex literal string
	});
});

describe("ArkSchemaPrinter - runtime constraints", () => {
	it("passes through a lone constraint expression unstripped", () => {
		// `string <= 20` is the sole intersection member, so isTsToken() is never
		// consulted and the raw arktype constraint text passes straight through.
		const t = type("string <= 20");
		expect(p.print(t, "in")).toBe("string <= 20");
	});

	it("drops a runtime constraint combined via & with nothing TS-expressible left, yielding unknown", () => {
		const t = type("string>5&string<=20");
		expect(p.print(t, "in")).toBe("unknown");
	});

	it("keeps a constraint on a nested object property unstripped (constraint is the sole intersection member there too)", () => {
		const t = type({ a: "string<=5" });
		expect(p.print(t, "in")).toBe("{ a: string <= 5 }");
	});
});

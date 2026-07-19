import { describe, expect, it } from "bun:test";

import type { Schema } from "@/schema/Schema";
import { SchemaPrinterAbstract } from "@/schema/SchemaPrinterAbstract";

/** Trivial concrete subclass so we can exercise the protected helpers directly. */
class TestPrinter extends SchemaPrinterAbstract {
	override print(_schema: Schema, _io: "in" | "out"): string {
		return "";
	}

	// re-expose protected members for testing
	splitPub(expr: string, sep: "&" | "|" | "," | ";") {
		return this.split(expr, sep);
	}
	wrapPub(s: string) {
		return this.wrap(s);
	}
	keyPub(k: string) {
		return this.key(k);
	}
	literalPub(v: unknown) {
		return this.literal(v);
	}
	topLevelColonPub(s: string) {
		return this.topLevelColon(s);
	}
	sortUnionPub(members: string[]) {
		return this.sortUnion(members);
	}
}

const p = new TestPrinter();

describe("split", () => {
	it("splits on a top-level separator when spaces surround it (required for & / |)", () => {
		expect(p.splitPub("string | number", "|")).toEqual(["string", "number"]);
	});

	it("splits commas regardless of surrounding spaces", () => {
		expect(p.splitPub("a,b, c ,d", ",")).toEqual(["a", "b", "c", "d"]);
	});

	it("splits semicolons regardless of surrounding spaces", () => {
		expect(p.splitPub("a: string; b: number", ";")).toEqual(["a: string", "b: number"]);
	});

	it("requires surrounding spaces for & and | separators", () => {
		// no spaces around | -> should NOT split (this is how arktype distinguishes
		// the union operator from things like inequality operators)
		expect(p.splitPub("a|b", "|")).toEqual(["a|b"]);
		expect(p.splitPub("a & b", "&")).toEqual(["a", "b"]);
		expect(p.splitPub("a&b", "&")).toEqual(["a&b"]);
	});

	it("does not split inside braces", () => {
		expect(p.splitPub("{ a: string | number } | boolean", "|")).toEqual([
			"{ a: string | number }",
			"boolean",
		]);
	});

	it("does not split inside parens", () => {
		expect(p.splitPub("(string | number) | boolean", "|")).toEqual([
			"(string | number)",
			"boolean",
		]);
	});

	it("does not split inside brackets", () => {
		expect(p.splitPub("[string, number] | boolean", "|")).toEqual(["[string, number]", "boolean"]);
	});

	it("does not split inside quoted strings", () => {
		expect(p.splitPub('"a | b" | number', "|")).toEqual(['"a | b"', "number"]);
	});

	it("handles escaped quotes inside a quoted string", () => {
		expect(p.splitPub('"a \\" | b" | number', "|")).toEqual(['"a \\" | b"', "number"]);
	});

	it("filters out empty segments", () => {
		expect(p.splitPub("a,,b", ",")).toEqual(["a", "b"]);
	});

	it("handles nested brackets of mixed kinds", () => {
		expect(p.splitPub("{ a: [string, (number | boolean)] } | undefined", "|")).toEqual([
			"{ a: [string, (number | boolean)] }",
			"undefined",
		]);
	});
});

describe("wrap", () => {
	it("leaves a single token unwrapped", () => {
		expect(p.wrapPub("string")).toBe("string");
	});

	it("wraps a union in parens", () => {
		expect(p.wrapPub("string | number")).toBe("(string | number)");
	});

	it("wraps an intersection in parens", () => {
		expect(p.wrapPub("string & number")).toBe("(string & number)");
	});

	it("does not wrap a bracketed object even though it contains a union internally", () => {
		// split() won't see a top-level | inside the braces, so wrap should leave it alone
		expect(p.wrapPub("{ a: string | number }")).toBe("{ a: string | number }");
	});
});

describe("key", () => {
	it("leaves a valid identifier bare", () => {
		expect(p.keyPub("name")).toBe("name");
		expect(p.keyPub("_private")).toBe("_private");
		expect(p.keyPub("$id")).toBe("$id");
		expect(p.keyPub("a1")).toBe("a1");
	});

	it("quotes keys that are not valid identifiers", () => {
		expect(p.keyPub("first-name")).toBe('"first-name"');
		expect(p.keyPub("1abc")).toBe('"1abc"');
		expect(p.keyPub("has space")).toBe('"has space"');
		expect(p.keyPub("")).toBe('""');
	});
});

describe("literal", () => {
	it("stringifies primitives via JSON.stringify", () => {
		expect(p.literalPub("hello")).toBe('"hello"');
		expect(p.literalPub(42)).toBe("42");
		expect(p.literalPub(true)).toBe("true");
		expect(p.literalPub(null)).toBe("null");
	});

	it("normalizes undefined to the text 'undefined'", () => {
		expect(p.literalPub(undefined)).toBe("undefined");
	});

	it("renders bigint with a trailing n", () => {
		expect(p.literalPub(10n)).toBe("10n");
		expect(p.literalPub(0n)).toBe("0n");
	});
});

describe("topLevelColon", () => {
	it("finds a simple top-level colon", () => {
		expect(p.topLevelColonPub("a: string")).toBe(1);
	});

	it("returns -1 when there is no colon", () => {
		expect(p.topLevelColonPub("string")).toBe(-1);
	});

	it("ignores colons nested inside brackets", () => {
		expect(p.topLevelColonPub("[a: string]")).toBe(-1);
	});

	it("ignores colons inside quoted strings", () => {
		expect(p.topLevelColonPub('"a:b"')).toBe(-1);
	});

	it("finds the first top-level colon when the value itself contains nested colons", () => {
		expect(p.topLevelColonPub("a: { b: string }")).toBe(1);
	});
});

describe("sortUnion", () => {
	it("sorts structural members alphabetically", () => {
		expect(p.sortUnionPub(["string", "boolean", "number"])).toEqual([
			"boolean",
			"number",
			"string",
		]);
	});

	it("pushes null after structural members", () => {
		expect(p.sortUnionPub(["null", "string"])).toEqual(["string", "null"]);
	});

	it("pushes undefined after null", () => {
		expect(p.sortUnionPub(["undefined", "null", "string"])).toEqual([
			"string",
			"null",
			"undefined",
		]);
	});

	it("does not mutate the input array", () => {
		const input = ["undefined", "string"];
		const result = p.sortUnionPub(input);
		expect(input).toEqual(["undefined", "string"]);
		expect(result).toEqual(["string", "undefined"]);
	});
});

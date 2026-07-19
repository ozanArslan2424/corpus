import { describe, expect, it } from "bun:test";

import * as yup from "yup";

import { YupSchemaPrinter } from "@/schema/YupSchemaPrinter";

const p = new YupSchemaPrinter();

describe("YupSchemaPrinter - primitives", () => {
	it("prints an optional-by-default string as string | undefined", () => {
		// yup fields are optional unless .required() is called
		expect(p.print(yup.string(), "in")).toBe("string | undefined");
	});

	it("drops | undefined once .required() is applied", () => {
		expect(p.print(yup.string().required(), "in")).toBe("string");
	});

	it("prints boolean and date", () => {
		expect(p.print(yup.boolean().required(), "in")).toBe("boolean");
		expect(p.print(yup.date().required(), "in")).toBe("Date");
	});

	it("appends | null for nullable", () => {
		expect(p.print(yup.string().nullable(), "in")).toBe("string | undefined | null");
	});
});

describe("YupSchemaPrinter - default", () => {
	it("still reports optional even when a default value is set", () => {
		// yup keeps `optional: true` when only .default() is set (no .required())
		expect(p.print(yup.string().default("x"), "in")).toBe("string | undefined");
	});
});

describe("YupSchemaPrinter - oneOf", () => {
	it("prints a oneOf of strings as a literal union, ignoring the declared type", () => {
		const s = yup.string().oneOf(["a", "b"]);
		expect(p.print(s, "in")).toBe('"a" | "b" | undefined');
	});

	it("prints a oneOf of numbers as a literal union", () => {
		const s = yup.number().oneOf([1, 2, 3]);
		expect(p.print(s, "in")).toBe("1 | 2 | 3 | undefined");
	});
});

describe("YupSchemaPrinter - array", () => {
	it("wraps the inner type in Array<...> and keeps optionality", () => {
		const s = yup.array().of(yup.string().required());
		expect(p.print(s, "in")).toBe("Array<string> | undefined");
	});

	it("falls back to Array<unknown> when no inner type is declared", () => {
		expect(p.print(yup.array(), "in")).toBe("Array<unknown> | undefined");
	});

	it("propagates inner-field optionality into the array element type", () => {
		const s = yup.array().of(yup.string());
		expect(p.print(s, "in")).toBe("Array<string | undefined> | undefined");
	});
});

describe("YupSchemaPrinter - tuple", () => {
	it("prints tuple members positionally", () => {
		// the tuple schema itself is optional-by-default (yup.tuple() isn't marked
		// .required()), independent of whether its members are required
		const s = yup.tuple([yup.string().required(), yup.number().required()]);
		expect(p.print(s, "in")).toBe("[string, number] | undefined");
	});

	it("drops | undefined when the tuple schema itself is required", () => {
		const s = yup.tuple([yup.string().required(), yup.number().required()]).required();
		expect(p.print(s, "in")).toBe("[string, number]");
	});
});

describe("YupSchemaPrinter - object", () => {
	it("prints object fields sorted by key, marking required fields without a ?", () => {
		// note: the object schema itself is optional-by-default (no .required()),
		// so " | undefined" is appended after the object literal too
		const s = yup.object({
			name: yup.string().required(),
			age: yup.number(),
		});
		expect(p.print(s, "in")).toBe("{ age?: number; name: string } | undefined");
	});

	it("drops the outer | undefined once the object schema itself is required", () => {
		const s = yup
			.object({
				name: yup.string().required(),
				age: yup.number(),
			})
			.required();
		expect(p.print(s, "in")).toBe("{ age?: number; name: string }");
	});

	it("does not duplicate | undefined on an optional key (asKey suppresses it)", () => {
		const s = yup.object({ age: yup.number() }).required();
		expect(p.print(s, "in")).toBe("{ age?: number }");
	});

	it("prints nested objects", () => {
		const s = yup
			.object({
				a: yup.object({ b: yup.string() }),
			})
			.required();
		expect(p.print(s, "in")).toBe("{ a?: { b?: string } }");
	});
});

describe("YupSchemaPrinter - io parameter", () => {
	it("produces identical output for in and out (yup does not distinguish sides)", () => {
		const s = yup.object({ name: yup.string().required(), age: yup.number() });
		expect(p.print(s, "in")).toBe(p.print(s, "out"));
	});
});

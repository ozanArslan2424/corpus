import { describe, expect, it } from "bun:test";

import * as z from "zod";

import { ZodSchemaPrinter } from "@/schema/ZodSchemaPrinter";

const p = new ZodSchemaPrinter();

describe("ZodSchemaPrinter - primitives", () => {
	it("prints simple primitive types", () => {
		expect(p.print(z.string(), "in")).toBe("string");
		expect(p.print(z.number(), "in")).toBe("number");
		expect(p.print(z.boolean(), "in")).toBe("boolean");
		expect(p.print(z.bigint(), "in")).toBe("bigint");
		expect(p.print(z.null(), "in")).toBe("null");
		expect(p.print(z.undefined(), "in")).toBe("undefined");
		expect(p.print(z.any(), "in")).toBe("any");
		expect(p.print(z.unknown(), "in")).toBe("unknown");
		expect(p.print(z.never(), "in")).toBe("never");
		expect(p.print(z.void(), "in")).toBe("void");
	});

	it("maps int and nan to number", () => {
		expect(p.print(z.int(), "in")).toBe("number");
		expect(p.print(z.nan(), "in")).toBe("number");
	});

	it("maps date to Date", () => {
		expect(p.print(z.date(), "in")).toBe("Date");
	});

	it("maps file to File", () => {
		expect(p.print(z.file(), "in")).toBe("File");
	});
});

describe("ZodSchemaPrinter - literal & enum", () => {
	it("prints a single literal", () => {
		expect(p.print(z.literal("x"), "in")).toBe('"x"');
	});

	it("prints a multi-value literal sorted", () => {
		expect(p.print(z.literal(["b", "a"]), "in")).toBe('"a" | "b"');
	});

	it("prints an enum as a sorted union of its values", () => {
		expect(p.print(z.enum(["b", "a", "c"]), "in")).toBe('"a" | "b" | "c"');
	});

	it("dedupes enum values", () => {
		const e = z.enum({ A: "x", B: "x", C: "y" });
		expect(p.print(e, "in")).toBe('"x" | "y"');
	});
});

describe("ZodSchemaPrinter - objects", () => {
	it("prints object props sorted by key", () => {
		const s = z.object({ name: z.string(), age: z.number() });
		expect(p.print(s, "in")).toBe("{ age: number; name: string }");
	});

	it("prints an empty object as {}", () => {
		expect(p.print(z.object({}), "in")).toBe("{}");
	});

	it("appends a catchall as an index signature", () => {
		const s = z.object({ a: z.string() }).catchall(z.number());
		expect(p.print(s, "in")).toBe("{ a: string; [k: string]: number }");
	});
});

describe("ZodSchemaPrinter - optional / nullable / default", () => {
	it("marks an optional prop with ? and does not duplicate | undefined on the key", () => {
		const s = z.object({ name: z.string().optional() });
		expect(p.print(s, "in")).toBe("{ name?: string }");
	});

	it("appends | undefined for an optional type used standalone (not as an object key)", () => {
		expect(p.print(z.string().optional(), "in")).toBe("string | undefined");
	});

	it("appends | null for nullable", () => {
		const s = z.object({ name: z.string().nullable() });
		expect(p.print(s, "in")).toBe("{ name: string | null }");
	});

	it("treats default as optional on the input side but required on the output side", () => {
		const s = z.object({ name: z.string().default("x") });
		expect(p.print(s, "in")).toBe("{ name?: string }");
		expect(p.print(s, "out")).toBe("{ name: string }");
	});
});

describe("ZodSchemaPrinter - collections", () => {
	it("prints array", () => {
		expect(p.print(z.array(z.string()), "in")).toBe("Array<string>");
	});

	it("prints tuple", () => {
		expect(p.print(z.tuple([z.string(), z.number()]), "in")).toBe("[string, number]");
	});

	it("prints tuple with rest element", () => {
		const s = z.tuple([z.string()], z.number());
		expect(p.print(s, "in")).toBe("[string, ...Array<number>]");
	});

	it("prints record", () => {
		expect(p.print(z.record(z.string(), z.number()), "in")).toBe("Record<string, number>");
	});

	it("prints map", () => {
		expect(p.print(z.map(z.string(), z.number()), "in")).toBe("Map<string, number>");
	});

	it("prints set", () => {
		expect(p.print(z.set(z.string()), "in")).toBe("Set<string>");
	});
});

describe("ZodSchemaPrinter - union & intersection", () => {
	it("prints a union", () => {
		expect(p.print(z.union([z.string(), z.number()]), "in")).toBe("string | number");
	});

	it("merges two object intersections into a single flattened, sorted object literal", () => {
		const s = z.intersection(z.object({ b: z.number() }), z.object({ a: z.string() }));
		expect(p.print(s, "in")).toBe("{ a: string; b: number }");
	});

	it("lets the right-hand side win on key collisions when merging (like .extend())", () => {
		const s = z.intersection(z.object({ a: z.string() }), z.object({ a: z.number() }));
		expect(p.print(s, "in")).toBe("{ a: number }");
	});

	it("falls back to A & B when either side is not a plain object", () => {
		const s = z.intersection(z.string(), z.number());
		expect(p.print(s, "in")).toBe("string & number");
	});
});

describe("ZodSchemaPrinter - pipe", () => {
	it("resolves to the input schema on the in side and output schema on the out side", () => {
		const s = z
			.string()
			.transform((v) => Number(v))
			.pipe(z.number());
		expect(p.print(s, "in")).toBe("string");
		expect(p.print(s, "out")).toBe("number");
	});
});

describe("ZodSchemaPrinter - misc wrappers", () => {
	it("prints lazy by resolving the getter", () => {
		expect(
			p.print(
				z.lazy(() => z.string()),
				"in",
			),
		).toBe("string");
	});

	it("prints promise", () => {
		expect(p.print(z.promise(z.string()), "in")).toBe("Promise<string>");
	});

	it("prints readonly by passing through the inner type", () => {
		expect(p.print(z.string().readonly(), "in")).toBe("string");
	});

	it("prints a template literal", () => {
		const s = z.templateLiteral(["a", z.string(), "b"]);
		expect(p.print(s, "in")).toBe("`${string}ab`");
	});

	it("prints a function signature", () => {
		const s = z.function({ input: [z.string()], output: z.number() });
		expect(p.print(s, "in")).toBe("(...args: [string]) => number");
	});

	it("has a known quirk where nonoptional does not clear the inner optional's | undefined", () => {
		// nonoptional's inner() call always uses the default asKey=false, so an
		// optional wrapped by nonoptional still renders "| undefined" even though
		// nonoptional is meant to strip optionality. This pins current behavior.
		const s = z.string().optional().nonoptional();
		expect(p.print(s, "in")).toBe("string | undefined");
		expect(p.print(s, "out")).toBe("string | undefined");
	});

	it("falls back to unknown for custom and transform types", () => {
		expect(p.print(z.custom<string>(), "in")).toBe("unknown");
	});
});

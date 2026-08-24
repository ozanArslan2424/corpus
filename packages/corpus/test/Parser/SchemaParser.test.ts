import { beforeEach, describe, expect, it } from "bun:test";

import type { Schema, ValidationIssues } from "@ozanarslan/utils/schema";

import type { SchemaParser } from "@/Parser/SchemaParser";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { TestModel } from "../utils/TestModel";
import { TestParsingController } from "../utils/TestParsingController";

const GOOD = { hello: 1 };
const BAD = { unknown: "object" };

createTestServer();

beforeEach(() => {
	$registryTesting.reset();
	new TestParsingController();
});

const parser = $registryTesting.schemaParser as SchemaParser;
const parse = (data: unknown, schema: Schema) => parser.parse("test", data, schema);

// Inline sync and async validators for parser.parseSync tests.
// These mimic the Standard Schema validator shape.
const syncSchema: Schema<typeof GOOD> = {
	"~standard": {
		validate: (input) => {
			if (input && typeof input === "object" && "hello" in input && input.hello === 1) {
				return { value: input as typeof GOOD };
			}
			return {
				value: undefined as never,
				issues: [{ message: "expected { hello: 1 }", path: ["hello"] }],
			};
		},
	} as Schema<typeof GOOD>["~standard"],
};

const asyncValidator: Schema<typeof GOOD> = {
	"~standard": {
		validate: async (input) => {
			if (input && typeof input === "object" && "hello" in input && input.hello === 1) {
				return { value: input as typeof GOOD };
			}
			return {
				value: undefined as never,
				issues: [{ message: "expected { hello: 1 }", path: ["hello"] }],
			};
		},
	} as Schema<typeof GOOD>["~standard"],
};

const thenableValidator: Schema<typeof GOOD> = {
	"~standard": {
		validate: (input: unknown) => ({
			then: (resolve: (v: unknown) => void) => resolve(syncSchema["~standard"].validate(input)),
		}),
	},
} as Schema<typeof GOOD>;

describe("Parser unit", () => {
	describe("success", () => {
		it("ark object", () => {
			expect(parse(GOOD, TestModel.arkObject)).resolves.toEqual(GOOD);
		});
		it("zod object", () => {
			expect(parse(GOOD, TestModel.zodObject)).resolves.toEqual(GOOD);
		});
		it("ark route — coerces params and search, passes body through", () => {
			expect(parse(GOOD, TestModel.arkRoute.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRoute.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRoute.body)).resolves.toEqual(GOOD);
		});
		it("zod route — coerces params and search, passes body through", () => {
			expect(parse(GOOD, TestModel.zodRoute.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRoute.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRoute.body)).resolves.toEqual(GOOD);
		});
		it("ark route (referenced schemas)", () => {
			expect(parse(GOOD, TestModel.arkRouteReferenced.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRouteReferenced.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRouteReferenced.body)).resolves.toEqual(GOOD);
		});
		it("zod route (referenced schemas)", () => {
			expect(parse(GOOD, TestModel.zodRouteReferenced.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRouteReferenced.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRouteReferenced.body)).resolves.toEqual(GOOD);
		});
	});

	describe("failure", () => {
		it("ark object", () => {
			expect(parse(BAD, TestModel.arkObject)).rejects.toThrow(TC.Exception);
		});
		it("zod object", () => {
			expect(parse(BAD, TestModel.zodObject)).rejects.toThrow(TC.Exception);
		});
		it("ark route", () => {
			expect(parse(BAD, TestModel.arkRoute.params)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.arkRoute.search)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.arkRoute.body)).rejects.toThrow(TC.Exception);
		});
		it("zod route", () => {
			expect(parse(BAD, TestModel.zodRoute.params)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.zodRoute.search)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.zodRoute.body)).rejects.toThrow(TC.Exception);
		});
		it("ark route (referenced schemas)", () => {
			expect(parse(BAD, TestModel.arkRouteReferenced.params)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.arkRouteReferenced.search)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.arkRouteReferenced.body)).rejects.toThrow(TC.Exception);
		});
		it("zod route (referenced schemas)", () => {
			expect(parse(BAD, TestModel.zodRouteReferenced.params)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.zodRouteReferenced.search)).rejects.toThrow(TC.Exception);
			expect(parse(BAD, TestModel.zodRouteReferenced.body)).rejects.toThrow(TC.Exception);
		});
	});

	describe("parser.parse — no validator", () => {
		it("returns data as-is when validator is undefined", () => {
			expect(parser.parse("test", GOOD, undefined)).resolves.toEqual(GOOD);
		});

		it("returns data as-is when validator is omitted", () => {
			expect(parser.parse("test", GOOD)).resolves.toEqual(GOOD);
		});

		it("preserves reference identity when no validator runs", async () => {
			const ref = { a: 1 };
			const result = await parser.parse("test", ref);
			expect(result).toBe(ref);
		});
	});

	describe("parser.parseSync", () => {
		it("returns data as-is when validator is undefined", () => {
			expect(parser.parseSync<typeof GOOD>("test", GOOD)).toEqual(GOOD);
		});

		it("returns validated value for sync validator on good input", () => {
			expect(parser.parseSync("test", GOOD, syncSchema)).toEqual(GOOD);
		});

		it("throws Exception for sync validator on bad input", () => {
			expect(() => parser.parseSync("test", BAD, syncSchema)).toThrow(TC.Exception);
		});

		it("throws when given an async validator", () => {
			expect(() => parser.parseSync("test", GOOD, asyncValidator)).toThrow(
				"parseSync called with async validator",
			);
		});

		it("throws when given a thenable (non-Promise) validator", () => {
			expect(() => parser.parseSync("test", GOOD, thenableValidator)).toThrow(
				"parseSync called with async validator",
			);
		});
	});

	describe("parser.issuesToErrorMessage", () => {
		it("returns an empty string for no issues", () => {
			expect(parser.issuesToErrorMessage("body", {}, [])).toBe("");
		});

		it("returns the raw message for issues without a path", () => {
			const issues: ValidationIssues = [{ message: "invalid root" }];
			expect(parser.issuesToErrorMessage("body", {}, issues)).toBe("invalid root");
		});

		it("formats string-path issues with the received value", () => {
			const issues: ValidationIssues = [{ message: "expected number", path: ["hello"] }];
			expect(parser.issuesToErrorMessage("body", { hello: "oops" }, issues)).toBe(
				'in body hello (received "oops"): expected number',
			);
		});

		it("formats object-path issues using the key field", () => {
			const issues: ValidationIssues = [
				{
					message: "expected number",
					path: [{ key: "hello" } as unknown as string],
				},
			];
			expect(parser.issuesToErrorMessage("body", { hello: 42 }, issues)).toBe(
				"in body hello (received 42): expected number",
			);
		});

		it("joins nested path segments with dots", () => {
			const issues: ValidationIssues = [{ message: "expected string", path: ["user", "name"] }];
			expect(parser.issuesToErrorMessage("body", { user: { name: 123 } }, issues)).toBe(
				"in body user.name (received 123): expected string",
			);
		});

		it("omits received value when path does not resolve", () => {
			const issues: ValidationIssues = [{ message: "missing field", path: ["missing"] }];
			expect(parser.issuesToErrorMessage("body", {}, issues)).toBe(
				"in body missing: missing field",
			);
		});

		it("omits received value when traversal hits a non-object", () => {
			const issues: ValidationIssues = [{ message: "bad", path: ["a", "b"] }];
			expect(parser.issuesToErrorMessage("body", { a: "scalar" }, issues)).toBe("in body a.b: bad");
		});

		it("uses the label in the output", () => {
			const issues: ValidationIssues = [{ message: "expected number", path: ["id"] }];
			expect(parser.issuesToErrorMessage("params", { id: "x" }, issues)).toBe(
				'in params id (received "x"): expected number',
			);
		});

		it("joins multiple issues with newlines", () => {
			const issues: ValidationIssues = [
				{ message: "expected number", path: ["a"] },
				{ message: "expected string", path: ["b"] },
			];
			expect(parser.issuesToErrorMessage("body", { a: "x", b: 1 }, issues)).toBe(
				'in body a (received "x"): expected number\nin body b (received 1): expected string',
			);
		});
	});
});

import { describe, expect, it } from "bun:test";

import { type } from "arktype";
import { z } from "zod";

import { Exception } from "@/Exception";
import { Status } from "@/Res";
import { SchemaParser, type Schema, type ValidationIssues } from "@/SchemaParser";

const parser = new SchemaParser();

describe("SchemaParser", () => {
	describe("parse", () => {
		it("returns the input unchanged when no schema is given", async () => {
			const data = { anything: "goes" };
			const result = await parser.parse("body", data);
			expect(result).toBe(data);
		});

		describe("with a Zod schema", () => {
			const zodSchema = z.object({ name: z.string(), age: z.number() });

			it("returns the validated value on success", async () => {
				const result = await parser.parse("body", { name: "Ozan", age: 26 }, zodSchema);
				expect(result).toEqual({ name: "Ozan", age: 26 });
			});

			it("applies Zod transforms/coercions as part of validation", async () => {
				const coercing = z.object({ age: z.coerce.number() });
				const result = await parser.parse("body", { age: "26" }, coercing);
				expect(result).toEqual({ age: 26 });
			});

			it("throws an Exception with status 422 on validation failure", async () => {
				let error: unknown;
				try {
					await parser.parse("body", { name: "Ozan", age: "not a number" }, zodSchema);
					throw new Error("expected parse to throw");
				} catch (err) {
					error = err;
				}
				expect(error).toBeInstanceOf(Exception);
				expect((error as Exception).status).toBe(Status.UNPROCESSABLE_ENTITY);
			});

			it("attaches the original (invalid) data as the Exception's data", async () => {
				const invalid = { name: "Ozan", age: "not a number" };
				try {
					await parser.parse("body", invalid, zodSchema);
					throw new Error("expected parse to throw");
				} catch (err) {
					expect((err as Exception).data).toBe(invalid);
				}
			});

			it("includes the field path and received value in the error message", async () => {
				const invalid = { name: "Ozan", age: "not a number" };
				try {
					await parser.parse("body", invalid, zodSchema);
					throw new Error("expected parse to throw");
				} catch (err) {
					const message = (err as Exception).message;
					expect(message).toContain("in body age");
					expect(message).toContain('(received "not a number")');
				}
			});
		});

		describe("with an ArkType schema", () => {
			const arkSchema = type({ name: "string", age: "number" });

			it("returns the validated value on success", async () => {
				const result = await parser.parse("body", { name: "Ozan", age: 26 }, arkSchema);
				expect(result).toEqual({ name: "Ozan", age: 26 });
			});

			it("throws an Exception with status 422 on validation failure", async () => {
				let error: unknown;
				try {
					await parser.parse("body", { name: "Ozan", age: "not a number" }, arkSchema);
					throw new Error("expected parse to throw");
				} catch (err) {
					error = err;
				}
				expect(error).toBeInstanceOf(Exception);
				expect((error as Exception).status).toBe(Status.UNPROCESSABLE_ENTITY);
			});

			it("includes the field path in the error message", async () => {
				try {
					await parser.parse("body", { name: "Ozan", age: "not a number" }, arkSchema);
					throw new Error("expected parse to throw");
				} catch (err) {
					expect((err as Exception).message).toContain("in body age");
				}
			});
		});
	});

	describe("parseSync", () => {
		it("returns the input unchanged when no schema is given", () => {
			const data = { anything: "goes" };
			expect(parser.parseSync("body", data)).toBe(data as never);
		});

		describe("with a Zod schema", () => {
			const zodSchema = z.object({ name: z.string() });

			it("returns the validated value on success", () => {
				const result = parser.parseSync("body", { name: "Ozan" }, zodSchema);
				expect(result).toEqual({ name: "Ozan" });
			});

			it("throws an Exception with status 422 on validation failure", () => {
				expect(() => parser.parseSync("body", { name: 123 }, zodSchema)).toThrow(Exception);
			});
		});

		describe("with an ArkType schema", () => {
			const arkSchema = type({ name: "string" });

			it("returns the validated value on success", () => {
				const result = parser.parseSync("body", { name: "Ozan" }, arkSchema);
				expect(result).toEqual({ name: "Ozan" });
			});

			it("throws an Exception with status 422 on validation failure", () => {
				expect(() => parser.parseSync("body", { name: 123 }, arkSchema)).toThrow(Exception);
			});
		});

		it("throws a plain Error when the schema's validator is asynchronous", () => {
			// Zod/ArkType validate synchronously, so an async validator has to be
			// hand-built here to exercise this specific guard in isolation.
			const asyncSchema: Schema<{ name: string }> = {
				"~standard": {
					version: 1,
					vendor: "test",
					validate: async (value: unknown) => ({ value: value as { name: string } }),
				},
			};

			expect(() => parser.parseSync("body", { name: "Ozan" }, asyncSchema)).toThrow(
				"parseSync called with async validator",
			);
		});
	});

	describe("issuesToErrorMessage", () => {
		it("returns an empty string for no issues", () => {
			expect(parser.issuesToErrorMessage("body", {}, [])).toBe("");
		});

		it("formats a global issue with no path using just the message", () => {
			const issues: ValidationIssues = [{ message: "something went wrong globally", path: [] }];
			expect(parser.issuesToErrorMessage("body", {}, issues)).toBe("something went wrong globally");
		});

		it("formats a path-based issue with the label, key, and received value", () => {
			const issues: ValidationIssues = [{ message: "Expected number", path: ["age"] }];
			const result = parser.issuesToErrorMessage("body", { age: "old" }, issues);
			expect(result).toBe('in body age (received "old"): Expected number');
		});

		it("joins a nested path with dots", () => {
			const issues: ValidationIssues = [{ message: "Expected string", path: ["user", "name"] }];
			const data = { user: { name: 123 } };
			const result = parser.issuesToErrorMessage("body", data, issues);
			expect(result).toBe("in body user.name (received 123): Expected string");
		});

		it("resolves path segments given as objects with a 'key' property", () => {
			const issues: ValidationIssues = [{ message: "Expected string", path: [{ key: "name" }] }];
			const data = { name: 123 };
			const result = parser.issuesToErrorMessage("body", data, issues);
			expect(result).toBe("in body name (received 123): Expected string");
		});

		it("omits the received value when it resolves to undefined", () => {
			const issues: ValidationIssues = [{ message: "Missing field", path: ["missing"] }];
			const result = parser.issuesToErrorMessage("body", {}, issues);
			expect(result).toBe("in body missing: Missing field");
		});

		it("joins multiple issues with newlines", () => {
			const issues: ValidationIssues = [
				{ message: "Expected string", path: ["name"] },
				{ message: "Expected number", path: ["age"] },
			];
			const data = { name: 1, age: "x" };
			const result = parser.issuesToErrorMessage("body", data, issues);
			expect(result).toBe(
				'in body name (received 1): Expected string\nin body age (received "x"): Expected number',
			);
		});
	});
});

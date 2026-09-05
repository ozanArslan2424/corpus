import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Config } from "@/Config";

const ENV_KEY = "__CONFIG_TEST_KEY__";
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
	originalEnv = { ...process.env };
});

afterEach(() => {
	process.env = originalEnv;
});

describe("Config", () => {
	describe("env", () => {
		it("returns process.env", () => {
			expect(Config.env).toBe(process.env);
		});
	});

	describe("nodeEnv", () => {
		it("defaults to 'development' when NODE_ENV is unset", () => {
			delete process.env.NODE_ENV;
			expect(Config.nodeEnv).toBe("development");
		});

		it("returns the actual NODE_ENV value when set", () => {
			process.env.NODE_ENV = "production";
			expect(Config.nodeEnv).toBe("production");
		});

		it("passes through arbitrary custom NODE_ENV values", () => {
			process.env.NODE_ENV = "staging";
			expect(Config.nodeEnv).toBe("staging");
		});
	});

	describe("isProd / isDev / isTest", () => {
		it("reports isProd when NODE_ENV is 'production'", () => {
			process.env.NODE_ENV = "production";
			expect(Config.isProd).toBe(true);
			expect(Config.isDev).toBe(false);
			expect(Config.isTest).toBe(false);
		});

		it("reports isDev when NODE_ENV is 'development'", () => {
			process.env.NODE_ENV = "development";
			expect(Config.isDev).toBe(true);
			expect(Config.isProd).toBe(false);
			expect(Config.isTest).toBe(false);
		});

		it("reports isTest when NODE_ENV is 'test'", () => {
			process.env.NODE_ENV = "test";
			expect(Config.isTest).toBe(true);
			expect(Config.isProd).toBe(false);
			expect(Config.isDev).toBe(false);
		});

		it("reports isDev when NODE_ENV is unset, since it defaults to 'development'", () => {
			delete process.env.NODE_ENV;
			expect(Config.isDev).toBe(true);
		});

		it("reports all three as false for a custom NODE_ENV value", () => {
			process.env.NODE_ENV = "staging";
			expect(Config.isProd).toBe(false);
			expect(Config.isDev).toBe(false);
			expect(Config.isTest).toBe(false);
		});
	});

	describe("has", () => {
		it("returns false when the key is unset", () => {
			delete process.env[ENV_KEY];
			expect(Config.has(ENV_KEY)).toBe(false);
		});

		it("returns true when the key is set to an empty string", () => {
			process.env[ENV_KEY] = "";
			expect(Config.has(ENV_KEY)).toBe(true);
		});

		it("returns true when the key has a value", () => {
			process.env[ENV_KEY] = "value";
			expect(Config.has(ENV_KEY)).toBe(true);
		});
	});

	describe("get", () => {
		it("returns the raw string value when the key is set", () => {
			process.env[ENV_KEY] = "value";
			expect(Config.get(ENV_KEY)).toBe("value");
		});

		it("returns undefined when the key is unset and no opts are given", () => {
			delete process.env[ENV_KEY];
			expect(Config.get(ENV_KEY)).toBeUndefined();
		});

		it("returns an empty string as-is when the key is set to an empty string", () => {
			process.env[ENV_KEY] = "";
			expect(Config.get(ENV_KEY)).toBe("");
		});

		it("returns the fallback when the key is unset", () => {
			delete process.env[ENV_KEY];
			expect(Config.get(ENV_KEY, { fallback: "fallback-value" })).toBe("fallback-value");
		});

		it("prefers the empty string over the fallback when the key is set to an empty string", () => {
			process.env[ENV_KEY] = "";
			expect(Config.get(ENV_KEY, { fallback: "fallback-value" })).toBe("");
		});

		it("prefers the actual value over the fallback when the key is set", () => {
			process.env[ENV_KEY] = "value";
			expect(Config.get(ENV_KEY, { fallback: "fallback-value" })).toBe("value");
		});

		it("applies the parser to the raw value when the key is set", () => {
			process.env[ENV_KEY] = "42";
			const result = Config.get(ENV_KEY, { parser: (raw) => parseInt(raw, 10), fallback: 0 });
			expect(result).toBe(42);
		});

		it("applies the parser to an empty string when the key is set to an empty string", () => {
			process.env[ENV_KEY] = "";
			const result = Config.get(ENV_KEY, { parser: (raw) => raw.length, fallback: -1 });
			expect(result).toBe(0);
		});

		it("returns the fallback unparsed when the key is unset, even with a parser given", () => {
			delete process.env[ENV_KEY];
			const result = Config.get(ENV_KEY, { parser: (raw) => parseInt(raw, 10), fallback: -1 });
			expect(result).toBe(-1);
		});

		it("returns undefined when the key is unset, a parser is given, but no fallback", () => {
			delete process.env[ENV_KEY];
			const result = Config.get(ENV_KEY, { parser: (raw) => parseInt(raw, 10) });
			expect(result).toBeUndefined();
		});
	});

	describe("require", () => {
		it("returns the raw string value when the key is set", () => {
			process.env[ENV_KEY] = "value";
			expect(Config.require(ENV_KEY)).toBe("value");
		});

		it("returns an empty string when the key is set to an empty string", () => {
			process.env[ENV_KEY] = "";
			expect(Config.require(ENV_KEY)).toBe("");
		});

		it("applies the parser to the raw value when given", () => {
			process.env[ENV_KEY] = "42";
			expect(Config.require(ENV_KEY, (raw) => parseInt(raw, 10))).toBe(42);
		});

		it("does not throw when the parser produces a falsy-but-defined result like 0", () => {
			process.env[ENV_KEY] = "0";
			expect(Config.require(ENV_KEY, (raw) => parseInt(raw, 10))).toBe(0);
		});

		it("throws when the key is unset", () => {
			delete process.env[ENV_KEY];
			expect(() => Config.require(ENV_KEY)).toThrow(
				`Required environment variable "${ENV_KEY}" is not set`,
			);
		});

		it("throws when the parser produces undefined, even though the raw value was present", () => {
			process.env[ENV_KEY] = "some-value";
			expect(() => Config.require(ENV_KEY, () => undefined as unknown as string)).toThrow(
				`Required environment variable "${ENV_KEY}" is not set`,
			);
		});
	});

	describe("set", () => {
		it("sets a string value as-is", () => {
			Config.set(ENV_KEY, "hello");
			expect(process.env[ENV_KEY]).toBe("hello");
		});

		it("stringifies a number value", () => {
			Config.set(ENV_KEY, 42);
			expect(process.env[ENV_KEY]).toBe("42");
		});

		it("stringifies a boolean value", () => {
			Config.set(ENV_KEY, true);
			expect(process.env[ENV_KEY]).toBe("true");
		});
	});
});

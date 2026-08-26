import { beforeEach, describe, expect, it } from "bun:test";

import { $registry } from "@/Registry/$registry";
import { Config } from "@/X/Config/Config";

beforeEach(() => $registry.reset());

describe("Config", () => {
	const undefinedKey = "undefined_env_var_key";
	const numberKey = "CONFIG_TEST_NUMBER_VAR_KEY";
	const numberVal = 8;
	const booleanKey = "CONFIG_TEST_BOOLEAN_VAR_KEY";
	const booleanVal = true;
	const key = "CONFIG_TEST_VAR_KEY";
	const val = "CONFIG_TEST_VAR_VALUE";

	it("set", () => {
		Config.set(key, val);
		expect(Config.env[key]).toBe(val);
		expect(Config.get<string>(key, { parser: String })).toBe(val);
		expect(process.env[key]).toBe(val);
		expect(Bun.env[key]).toBe(val);
	});

	it("set - coerces number", () => {
		Config.set(numberKey, numberVal);
		expect(Config.env[numberKey]).toBe("8");
	});

	it("set - coerces boolean", () => {
		Config.set(booleanKey, booleanVal);
		expect(Config.env[booleanKey]).toBe("true");
	});

	it("node_env", () => {
		const value = Config.nodeEnv;
		expect(value).toBe("test");
		expect(process.env.NODE_ENV === value).toBeTrue();
	});

	it("is_test", () => {
		expect(Config.isTest).toBeTrue();
		expect(Config.isProd).toBeFalse();
		expect(Config.isDev).toBeFalse();
	});

	it("has - defined", () => {
		Config.set(key, val);
		expect(Config.has(key)).toBeTrue();
	});

	it("has - undefined", () => {
		expect(Config.has(undefinedKey)).toBeFalse();
	});

	it("get - defined", () => {
		Config.set(key, val);
		expect(Config.get(key)).toBe(val);
	});

	it("get - defined parse number", () => {
		Config.set(numberKey, numberVal);
		expect(Config.get(numberKey, { parser: parseInt })).toBe(numberVal);
		expect(Config.get(numberKey, { parser: Number })).toBe(numberVal);
	});

	it("get - defined parse boolean", () => {
		Config.set(booleanKey, booleanVal);
		expect(Config.get(booleanKey, { parser: (v) => v === "true" })).toBe(booleanVal);
		expect(Config.get(booleanKey, { parser: Boolean })).toBe(booleanVal);
	});

	it("get - undefined", () => {
		expect(Config.get(undefinedKey)).toBeUndefined();
	});

	it("get - undefined with fallback", () => {
		const fallback = "fallback_value";
		expect(Config.get(undefinedKey, { fallback })).toBe(fallback);
	});

	it("get - undefined with parser no fallback", () => {
		expect(Config.get(undefinedKey, { parser: Number })).toBeUndefined();
	});

	it("get - fallback can be undefined explicitly", () => {
		expect(Config.get(undefinedKey, { fallback: undefined })).toBeUndefined();
	});

	it("require - defined", () => {
		Config.set(key, val);
		expect(Config.require<string>(key)).toBe(val);
	});

	it("require - defined with parser", () => {
		Config.set(numberKey, numberVal);
		expect(Config.require(numberKey, Number)).toBe(numberVal);
	});

	it("require - undefined throws", () => {
		expect(() => Config.require(undefinedKey)).toThrow(
			`Required environment variable "${undefinedKey}" is not set`,
		);
	});
});

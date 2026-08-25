import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TX } from "../_modules";

beforeEach(() => $registryTesting.reset());

describe("X.Config", () => {
	const undefinedKey = "undefined_env_var_key";
	const numberKey = "CONFIG_TEST_NUMBER_VAR_KEY";
	const numberVal = 8;
	const booleanKey = "CONFIG_TEST_BOOLEAN_VAR_KEY";
	const booleanVal = true;
	const key = "CONFIG_TEST_VAR_KEY";
	const val = "CONFIG_TEST_VAR_VALUE";

	it("set", () => {
		TX.Config.set(key, val);
		expect(TX.Config.env[key]).toBe(val);
		expect(TX.Config.get<string>(key, { parser: String })).toBe(val);
		expect(process.env[key]).toBe(val);
		expect(Bun.env[key]).toBe(val);
	});

	it("set - coerces number", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.env[numberKey]).toBe("8");
	});

	it("set - coerces boolean", () => {
		TX.Config.set(booleanKey, booleanVal);
		expect(TX.Config.env[booleanKey]).toBe("true");
	});

	it("node_env", () => {
		const value = TX.Config.nodeEnv;
		expect(value).toBe("test");
		expect(process.env.NODE_ENV === value).toBeTrue();
	});

	it("is_test", () => {
		expect(TX.Config.isTest).toBeTrue();
		expect(TX.Config.isProd).toBeFalse();
		expect(TX.Config.isDev).toBeFalse();
	});

	it("has - defined", () => {
		TX.Config.set(key, val);
		expect(TX.Config.has(key)).toBeTrue();
	});

	it("has - undefined", () => {
		expect(TX.Config.has(undefinedKey)).toBeFalse();
	});

	it("get - defined", () => {
		TX.Config.set(key, val);
		expect(TX.Config.get(key)).toBe(val);
	});

	it("get - defined parse number", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.get(numberKey, { parser: parseInt })).toBe(numberVal);
		expect(TX.Config.get(numberKey, { parser: Number })).toBe(numberVal);
	});

	it("get - defined parse boolean", () => {
		TX.Config.set(booleanKey, booleanVal);
		expect(TX.Config.get(booleanKey, { parser: (v) => v === "true" })).toBe(booleanVal);
		expect(TX.Config.get(booleanKey, { parser: Boolean })).toBe(booleanVal);
	});

	it("get - undefined", () => {
		expect(TX.Config.get(undefinedKey)).toBeUndefined();
	});

	it("get - undefined with fallback", () => {
		const fallback = "fallback_value";
		expect(TX.Config.get(undefinedKey, { fallback })).toBe(fallback);
	});

	it("get - undefined with parser no fallback", () => {
		expect(TX.Config.get(undefinedKey, { parser: Number })).toBeUndefined();
	});

	it("get - fallback can be undefined explicitly", () => {
		expect(TX.Config.get(undefinedKey, { fallback: undefined })).toBeUndefined();
	});

	it("require - defined", () => {
		TX.Config.set(key, val);
		expect(TX.Config.require<string>(key)).toBe(val);
	});

	it("require - defined with parser", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.require(numberKey, Number)).toBe(numberVal);
	});

	it("require - undefined throws", () => {
		expect(() => TX.Config.require(undefinedKey)).toThrow(
			`Required environment variable "${undefinedKey}" is not set`,
		);
	});
});

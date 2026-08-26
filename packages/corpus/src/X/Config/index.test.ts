import { beforeEach, describe, expect, it } from "bun:test";

import { $registry, X } from "#corpus";

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
		X.Config.set(key, val);
		expect(X.Config.env[key]).toBe(val);
		expect(X.Config.get<string>(key, { parser: String })).toBe(val);
		expect(process.env[key]).toBe(val);
		expect(Bun.env[key]).toBe(val);
	});

	it("set - coerces number", () => {
		X.Config.set(numberKey, numberVal);
		expect(X.Config.env[numberKey]).toBe("8");
	});

	it("set - coerces boolean", () => {
		X.Config.set(booleanKey, booleanVal);
		expect(X.Config.env[booleanKey]).toBe("true");
	});

	it("node_env", () => {
		const value = X.Config.nodeEnv;
		expect(value).toBe("test");
		expect(process.env.NODE_ENV === value).toBeTrue();
	});

	it("is_test", () => {
		expect(X.Config.isTest).toBeTrue();
		expect(X.Config.isProd).toBeFalse();
		expect(X.Config.isDev).toBeFalse();
	});

	it("has - defined", () => {
		X.Config.set(key, val);
		expect(X.Config.has(key)).toBeTrue();
	});

	it("has - undefined", () => {
		expect(X.Config.has(undefinedKey)).toBeFalse();
	});

	it("get - defined", () => {
		X.Config.set(key, val);
		expect(X.Config.get(key)).toBe(val);
	});

	it("get - defined parse number", () => {
		X.Config.set(numberKey, numberVal);
		expect(X.Config.get(numberKey, { parser: parseInt })).toBe(numberVal);
		expect(X.Config.get(numberKey, { parser: Number })).toBe(numberVal);
	});

	it("get - defined parse boolean", () => {
		X.Config.set(booleanKey, booleanVal);
		expect(X.Config.get(booleanKey, { parser: (v) => v === "true" })).toBe(booleanVal);
		expect(X.Config.get(booleanKey, { parser: Boolean })).toBe(booleanVal);
	});

	it("get - undefined", () => {
		expect(X.Config.get(undefinedKey)).toBeUndefined();
	});

	it("get - undefined with fallback", () => {
		const fallback = "fallback_value";
		expect(X.Config.get(undefinedKey, { fallback })).toBe(fallback);
	});

	it("get - undefined with parser no fallback", () => {
		expect(X.Config.get(undefinedKey, { parser: Number })).toBeUndefined();
	});

	it("get - fallback can be undefined explicitly", () => {
		expect(X.Config.get(undefinedKey, { fallback: undefined })).toBeUndefined();
	});

	it("require - defined", () => {
		X.Config.set(key, val);
		expect(X.Config.require<string>(key)).toBe(val);
	});

	it("require - defined with parser", () => {
		X.Config.set(numberKey, numberVal);
		expect(X.Config.require(numberKey, Number)).toBe(numberVal);
	});

	it("require - undefined throws", () => {
		expect(() => X.Config.require(undefinedKey)).toThrow(
			`Required environment variable "${undefinedKey}" is not set`,
		);
	});
});

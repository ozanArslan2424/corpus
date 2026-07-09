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

	it("SET", () => {
		TX.Config.set(key, val);
		expect(TX.Config.env[key]).toBe(val);
		expect(TX.Config.get<string>(key, { parser: String })).toBe(val);
		expect(process.env[key]).toBe(val);
		expect(Bun.env[key]).toBe(val);
	});

	it("SET - COERCES NUMBER", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.env[numberKey]).toBe("8");
	});

	it("SET - COERCES BOOLEAN", () => {
		TX.Config.set(booleanKey, booleanVal);
		expect(TX.Config.env[booleanKey]).toBe("true");
	});

	it("NODE_ENV", () => {
		const value = TX.Config.nodeEnv;
		expect(value).toBe("test");
		expect(process.env.NODE_ENV === value).toBeTrue();
	});

	it("IS_TEST", () => {
		expect(TX.Config.isTest).toBeTrue();
		expect(TX.Config.isProd).toBeFalse();
		expect(TX.Config.isDev).toBeFalse();
	});

	it("HAS - DEFINED", () => {
		TX.Config.set(key, val);
		expect(TX.Config.has(key)).toBeTrue();
	});

	it("HAS - UNDEFINED", () => {
		expect(TX.Config.has(undefinedKey)).toBeFalse();
	});

	it("GET - DEFINED", () => {
		TX.Config.set(key, val);
		expect(TX.Config.get(key)).toBe(val);
	});

	it("GET - DEFINED PARSE NUMBER", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.get(numberKey, { parser: parseInt })).toBe(numberVal);
		expect(TX.Config.get(numberKey, { parser: Number })).toBe(numberVal);
	});

	it("GET - DEFINED PARSE BOOLEAN", () => {
		TX.Config.set(booleanKey, booleanVal);
		expect(TX.Config.get(booleanKey, { parser: (v) => v === "true" })).toBe(booleanVal);
		expect(TX.Config.get(booleanKey, { parser: Boolean })).toBe(booleanVal);
	});

	it("GET - UNDEFINED", () => {
		expect(TX.Config.get(undefinedKey)).toBeUndefined();
	});

	it("GET - UNDEFINED WITH FALLBACK", () => {
		const fallback = "fallback_value";
		expect(TX.Config.get(undefinedKey, { fallback })).toBe(fallback);
	});

	it("GET - UNDEFINED WITH PARSER NO FALLBACK", () => {
		expect(TX.Config.get(undefinedKey, { parser: Number })).toBeUndefined();
	});

	it("GET - FALLBACK CAN BE UNDEFINED EXPLICITLY", () => {
		expect(TX.Config.get(undefinedKey, { fallback: undefined })).toBeUndefined();
	});

	it("REQUIRE - DEFINED", () => {
		TX.Config.set(key, val);
		expect(TX.Config.require<string>(key)).toBe(val);
	});

	it("REQUIRE - DEFINED WITH PARSER", () => {
		TX.Config.set(numberKey, numberVal);
		expect(TX.Config.require(numberKey, Number)).toBe(numberVal);
	});

	it("REQUIRE - UNDEFINED THROWS", () => {
		expect(() => TX.Config.require(undefinedKey)).toThrow(
			`Required environment variable "${undefinedKey}" is not set`,
		);
	});
});

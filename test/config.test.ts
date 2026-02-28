import C from "@/index";
import { describe, expect, it } from "bun:test";
import { RuntimeOptions } from "@/Config/enums/RuntimeOptions";

describe("C.Config", () => {
	const undefinedKey = "undefined_env_var_key";
	const numberKey = "CONFIG_TEST_NUMBER_VAR_KEY";
	const numberVal = 8;
	const booleanKey = "CONFIG_TEST_BOOLEAN_VAR_KEY";
	const booleanVal = true;
	const key = "CONFIG_TEST_VAR_KEY";
	const val = "CONFIG_TEST_VAR_VALUE";

	it("SET", () => {
		C.Config.set(key, val);
		expect(C.Config.env[key]).toBe(val);
		expect(C.Config.get<string>(key)).toBe(val);
		expect(process.env[key]).toBe(val);
		expect(Bun.env[key]).toBe(val);
	});

	it("NODE_ENV", () => {
		const value = C.Config.nodeEnv;
		expect(value).toBe("test");
		expect(process.env.NODE_ENV === value).toBeTrue();
	});

	it("GET - DEFINED", () => {
		expect(C.Config.get<string>(key)).toBe(val);
	});

	it("GET - DEFINED PARSE NUMBER", () => {
		C.Config.set(numberKey, numberVal);

		expect(C.Config.get(numberKey, { parser: parseInt })).toBe(numberVal);
		expect(C.Config.get(numberKey, { parser: Number })).toBe(numberVal);
	});

	it("GET - DEFINED PARSE BOOLEAN", () => {
		C.Config.set(booleanKey, booleanVal);

		expect(C.Config.get(booleanKey, { parser: (v) => v === "true" })).toBe(
			booleanVal,
		);
		expect(C.Config.get(booleanKey, { parser: Boolean })).toBe(booleanVal);
	});

	it("GET - UNDEFINED", () => {
		expect(C.Config.get(undefinedKey)).toBeUndefined();
	});

	it("GET - UNDEFINED WITH FALLBACK", () => {
		const fallback = "fallback_value";
		expect(C.Config.get(undefinedKey, { fallback })).toBe(fallback);
	});

	it("RUNTIME", () => {
		// The tests are using bun.
		expect(C.Config.runtime).toBe(RuntimeOptions.bun);
	});
});

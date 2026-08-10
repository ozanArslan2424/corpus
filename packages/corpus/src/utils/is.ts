import type { Primitive, nil } from "@/utils/types";

export function isFunction<T>(input: T): input is Extract<T, (...args: any[]) => any> {
	return typeof input === "function";
}

export function isClass<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	return isFunction(input) && /^class\s/.test(Function.prototype.toString.call(input));
}

export function isNewable<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	if (typeof input !== "function") return false;
	try {
		Reflect.construct(String, [], input);
		return true;
	} catch {
		return false;
	}
}

export function isPrimitive(input: unknown): input is Primitive {
	return isString(input) || isNumber(input) || isBoolean(input) || isBigint(input);
}

export function isNull<T>(input: T): input is Extract<T, null> {
	return input === null;
}

export function isUndefined<T>(input: T): input is Extract<T, undefined> {
	return input === undefined;
}

export function isNil<T>(input: T): input is Extract<T, nil> {
	return isUndefined(input) || isNull(input);
}

export function isEmpty<T>(input: T): input is Extract<T, nil | "" | 0> {
	if (isNil(input)) return false;
	if (isString(input)) return input.trim() === "";
	if (isNumber(input)) return input === 0;
	if (isObject(input)) return JSON.stringify(input) === JSON.stringify({});
	if (Array.isArray(input)) return input.length === 0;
	return false; // nil is not empty
}

export function isObject(input: unknown): input is Record<string, unknown> {
	if (isNil(input) || typeof input !== "object" || Array.isArray(input)) return false;
	const proto = Object.getPrototypeOf(input);
	return proto === Object.prototype || proto === null;
}

export function isString<T>(input: T): input is Extract<T, string> {
	return typeof input === "string";
}

export function isBoolean<T>(input: T): input is Extract<T, boolean> {
	return typeof input === "boolean";
}

export function isNumber<T>(input: T): input is Extract<T, number> {
	return typeof input === "number";
}

export function isBigint<T>(input: T): input is Extract<T, bigint> {
	return typeof input === "bigint";
}

export function isSomeArray<T = string>(input: unknown): input is T[] {
	return (
		!isNil(input) && Array.isArray(input) && input.length > 0 && input.every((it) => !isNil(it))
	);
}

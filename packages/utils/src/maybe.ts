import { isString } from "@/lexical";
import { isNumber } from "@/numerical";
import { isObject } from "@/object";

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | null | undefined;

export function isNull<T>(input: T): input is Extract<T, null> {
	return input === null;
}

export function isUndefined<T>(input: T): input is Extract<T, undefined> {
	return input === undefined;
}

export function isNil<T>(input: T): input is Extract<T, null | undefined> {
	return isUndefined(input) || isNull(input);
}

export function isEmpty<T>(input: T): input is Extract<T, null | undefined | "" | 0> {
	if (isNil(input)) return true;
	if (isString(input)) return input.trim() === "";
	if (isNumber(input)) return input === 0;
	if (isObject(input)) return JSON.stringify(input) === JSON.stringify({});
	if (Array.isArray(input)) return input.length === 0;
	return false;
}

import { isString } from "@/utils/lexical";
import { isNumber } from "@/utils/numerical";
import { isObject } from "@/utils/object";

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = Optional<Nullable<T>>;
export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | Array<T>;

export const EMPTY: unique symbol = Symbol("empty");
export type EMPTY = typeof EMPTY;

export function isNull<T>(input: T): input is Extract<T, null> {
	return input === null;
}

export function isUndefined<T>(input: T): input is Extract<T, undefined> {
	return input === undefined;
}

export function isNil<T>(input: T): input is Extract<T, null | undefined> {
	return isUndefined(input) || isNull(input);
}

export function isEmptySymbol<T>(input: T): input is Extract<T, EMPTY> {
	return input === EMPTY;
}

export function isEmpty<T>(input: T): input is Extract<T, EMPTY | null | undefined | "" | 0> {
	if (isEmptySymbol(input)) return true;
	if (isNil(input)) return true;
	if (isString(input)) return input.trim() === "";
	if (isNumber(input)) return input === 0;
	if (isObject(input)) return Object.keys(input).length === 0;
	if (Array.isArray(input)) return input.length === 0;
	return false;
}

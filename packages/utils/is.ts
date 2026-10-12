export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = Optional<Nullable<T>>;
export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | Array<T>;
export type OrString<T> = T | (string & {});
export type Primitive = string | number | boolean | bigint;

export const EMPTY: unique symbol = Symbol("empty");
export type EMPTY = typeof EMPTY;

export function isPresent<T>(input: T): input is Exclude<T, null | undefined | EMPTY> {
	return input !== undefined && input !== null && input !== EMPTY;
}

export function isAbsent<T>(input: T): input is Extract<T, null | undefined | EMPTY> {
	return !isPresent(input);
}

export function isPrimitive<T>(input: T): input is Extract<T, Primitive> {
	return isOneOf(typeof input, ["string", "number", "boolean", "bigint"]);
}

export function isObject(input: unknown): input is Record<string, unknown> {
	if (isAbsent(input) || typeof input !== "object" || Array.isArray(input)) return false;
	return Object.getPrototypeOf(input) === Object.prototype;
}

export function isOneOf<const T extends readonly unknown[]>(
	input: unknown,
	array: T,
): input is T[number] {
	return array.includes(input);
}

export function isSomeArray<T = string>(input: unknown): input is Array<T> {
	return isPresent(input) && Array.isArray(input) && input.length > 0;
}

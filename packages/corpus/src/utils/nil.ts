export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | null | undefined;

export function isNil<T>(input: T): input is Extract<T, null | undefined> {
	return input === null || input === undefined;
}

export function isDefined<T>(input: T): input is Exclude<T, null | undefined> {
	return !isNil(input);
}

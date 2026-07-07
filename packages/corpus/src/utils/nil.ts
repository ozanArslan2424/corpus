export type nil = null | undefined;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | nil;

export function isNil<T>(input: T): input is Extract<T, null | undefined> {
	return input === null || input === undefined;
}

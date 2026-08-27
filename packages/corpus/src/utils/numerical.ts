export function isNumber<T>(input: T): input is Extract<T, number> {
	return typeof input === "number";
}

export function isBigint<T>(input: T): input is Extract<T, bigint> {
	return typeof input === "bigint";
}

export function isTypeOfUndefined<T>(value: T | undefined): value is undefined {
	return typeof value === "undefined";
}

export function isIterable<T = any>(obj: any): obj is Iterable<T> {
	return obj != null && typeof obj[Symbol.iterator] === "function";
}

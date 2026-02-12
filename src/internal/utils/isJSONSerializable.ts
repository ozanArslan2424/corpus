export function isJSONSerializable(data: any): data is object {
	return (
		data &&
		typeof data === "object" &&
		!(data instanceof ArrayBuffer) &&
		!(data instanceof Blob) &&
		!(data instanceof FormData) &&
		!(data instanceof URLSearchParams) &&
		!(data instanceof ReadableStream) &&
		!(typeof data === "string")
	);
}

export function shouldSerializeAsJSON(data: any): boolean {
	if (data === null || data === undefined) return false;
	if (typeof data !== "object") return false;
	if (data instanceof ArrayBuffer) return false;
	if (data instanceof Blob) return false;
	if (data instanceof FormData) return false;
	if (data instanceof URLSearchParams) return false;
	if (data instanceof ReadableStream) return false;

	if (Array.isArray(data)) return true;
	if (data.constructor === Object) return true;
	return false;
}

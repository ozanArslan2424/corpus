import { isNil } from "@ozanarslan/utils";
import { isPrimitive } from "@ozanarslan/utils";

export function resolveResBody(b: unknown): [BodyInit | null | undefined, string | undefined] {
	if (isNil(b)) return [b as BodyInit | null | undefined, undefined];
	if (isPrimitive(b)) return [String(b), "text/plain"];
	if (typeof b !== "object") return [String(b), undefined];
	if (b instanceof ArrayBuffer) return [b, "application/octet-stream"];
	if (b instanceof Blob) return [b, b.type || undefined];
	if (b instanceof FormData) return [b, "multipart/form-data"];
	if (b instanceof URLSearchParams) return [b, "application/x-www-form-urlencoded"];
	if (b instanceof ReadableStream) return [b, undefined];
	if (b instanceof Date) return [b.toISOString(), "text/plain"];
	return [JSON.stringify(b), "application/json"];
}

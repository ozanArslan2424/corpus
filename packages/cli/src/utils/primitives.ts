export type Primitive = string | number | boolean | bigint;

export function isPrimitive(input: unknown): input is Primitive {
	return (
		typeof input === "string" ||
		typeof input === "number" ||
		typeof input === "boolean" ||
		typeof input === "bigint"
	);
}

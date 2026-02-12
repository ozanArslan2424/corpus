export function textIsDefined(
	input: string | undefined | null,
): input is string {
	return !!input?.trim() && typeof input === "string";
}

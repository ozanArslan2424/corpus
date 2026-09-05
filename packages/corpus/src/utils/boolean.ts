export function isBoolean<T>(input: T): input is Extract<T, boolean> {
	return typeof input === "boolean";
}

export function boolString(input: boolean | undefined): string {
	return input ? "true" : "false";
}

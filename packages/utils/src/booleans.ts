export function isBoolean<T>(input: T): input is Extract<T, boolean> {
	return typeof input === "boolean";
}

export function boolToString(arg: boolean | undefined): string {
	return arg ? "true" : "false";
}

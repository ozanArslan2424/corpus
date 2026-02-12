export function isSomeArray<T = string>(arg: T[] | undefined): arg is T[] {
	return (
		arg !== undefined &&
		Array.isArray(arg) &&
		arg.length > 0 &&
		arg.every((a) => a !== null && a !== undefined)
	);
}

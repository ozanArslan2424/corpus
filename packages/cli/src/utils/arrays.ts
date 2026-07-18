// export function arrIncludes<I = string>(input: I, array: readonly I[]) {
// 	return array.includes(input);
// }

export function arrIncludes<const T extends readonly unknown[]>(
	input: unknown,
	array: T,
): input is T[number] {
	return array.includes(input);
}

export function isFoundIn<I = string>(input: I, array: I[]) {
	return array.includes(input);
}

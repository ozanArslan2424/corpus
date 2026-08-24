import { isNil } from "@/maybe";

export function arrIncludes<const T extends readonly unknown[]>(
	input: unknown,
	array: T,
): input is T[number] {
	return array.includes(input);
}

export function isSomeArray<T = string>(input: unknown): input is T[] {
	return (
		!isNil(input) && Array.isArray(input) && input.length > 0 && input.every((it) => !isNil(it))
	);
}

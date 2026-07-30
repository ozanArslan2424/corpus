import { isNil } from "@/utils/is";

export function arrIncludes<const T extends readonly unknown[]>(
	input: unknown,
	array: T,
): input is T[number] {
	return array.includes(input);
}

export function isSomeArray<T = string>(input: unknown): input is T[] {
	if (isNil(input)) return false;

	return Array.isArray(input) && input.length > 0 && input.every((it) => !isNil(it));
}

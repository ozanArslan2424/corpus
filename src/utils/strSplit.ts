import { assert } from "@/utils/assert";

export function strSplit(
	mark: string,
	input: string,
	minLength?: number,
): string[] {
	const parts = input
		.split(mark)
		.map((part) => part.trim())
		.filter(Boolean);

	if (minLength) {
		assert(parts.length >= minLength);
		return parts;
	}

	return parts;
}

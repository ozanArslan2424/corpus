import { assert } from "@/internal/utils/assert";

export function textExtract(delimiters: string, input: string): string {
	const [start, end] = delimiters.split("");
	assert(start, "Delimiters must be a string of length 2.");
	assert(end, "Delimiters must be a string of length 2.");

	const startIdx = input.indexOf(start);
	const endIdx = input.indexOf(end, startIdx + 1);

	if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
		return "";
	}

	return input.slice(startIdx + 1, endIdx);
}

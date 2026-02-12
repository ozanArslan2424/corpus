export function textSplit(mark: string, input: string): string[] {
	return input
		.split(mark)
		.map((part) => part.trim())
		.filter(Boolean);
}

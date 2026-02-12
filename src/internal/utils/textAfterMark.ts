export function textAfterMark(mark: string, input: string): string {
	const index = input.indexOf(mark);
	return index === -1 ? "" : input.slice(index + mark.length);
}

export function strBeforeMark(mark: string, input: string): string {
	const index = input.indexOf(mark);
	return index === -1 ? input : input.slice(0, index);
}

export function patternIsEqual(source: string, pattern: RegExp): boolean {
	return pattern.test(source);
}

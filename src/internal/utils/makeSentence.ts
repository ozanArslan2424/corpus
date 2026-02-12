export function makeSentence(input: string[]) {
	if (!input[0]) return "";
	const first = input[0].charAt(0).toLocaleUpperCase() + input[0].slice(1);
	const rest = input.slice(1);
	if (!rest) return first + ".";
	return [first, ...rest].join(", ") + ".";
}

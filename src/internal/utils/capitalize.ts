export function capitalize(input: string): string {
	return input.length > 0
		? input
				.split(" ")
				.map((part) => part.charAt(0).toLocaleUpperCase() + input.slice(1))
				.join(" ")
		: input;
}

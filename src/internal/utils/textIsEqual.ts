export function textIsEqual(
	source: string,
	target: string,
	modifier?: "upper" | "lower",
) {
	source = source.trim();
	target = target.trim();

	if (modifier === "upper") {
		return source.toUpperCase() === target.toUpperCase();
	}

	if (modifier === "lower") {
		return source.toUpperCase() === target.toUpperCase();
	}

	return source === target;
}

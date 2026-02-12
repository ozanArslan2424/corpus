export function appendEntry(
	data: Record<string, unknown>,
	key: string,
	value: string | boolean | number,
) {
	const existing = data[key];
	if (existing !== undefined) {
		data[key] = Array.isArray(existing)
			? [...existing, value]
			: [existing, value];
	} else {
		data[key] = value;
	}
}

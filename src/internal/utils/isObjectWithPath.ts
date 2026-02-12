export function isObjectWithPath<T extends Record<string, unknown>>(
	item: unknown,
	...path: string[]
): item is T {
	if (!item || typeof item !== "object") return false;

	let current = item as Record<string, unknown>;

	for (const key of path) {
		if (!(key in current)) return false;
		if (typeof current[key] !== "object" || current[key] === null) {
			return false;
		}
		current = current[key] as Record<string, unknown>;
	}

	return true;
}

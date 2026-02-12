export function getKeys<V = any>(source: {} | Map<string, V>): string[] {
	if (source instanceof Map) {
		return Array.from(source.keys());
	}
	return Object.keys(source);
}

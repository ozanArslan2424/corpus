export function getEntries<V>(source: {} | Map<string, V>): [string, V][] {
	if (source instanceof Map) {
		return Array.from(source.entries());
	}
	return Object.entries(source);
}

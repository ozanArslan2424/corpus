export function getValues<V>(
	source: { [key: string]: V } | ArrayLike<V> | Map<any, V>,
): V[] {
	if (source instanceof Map) {
		return Array.from(source.values());
	}
	return Object.values(source);
}

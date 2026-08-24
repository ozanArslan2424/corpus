import { isSomeArray } from "./array";

type CacheEntry<T> = {
	value: T;
	expiresAt: number;
};

const map = new Map<string, CacheEntry<unknown>>();

const TWO_MIN = 2 * 60 * 1000;

export function cache<A extends unknown[], T>(
	key: string,
	callback: (...args: A) => T,
	ttlMs = TWO_MIN,
): (...args: A) => T {
	return (...args: A) => {
		const cacheKey = args.length ? `${key}:${JSON.stringify(args)}` : key;
		const entry = map.get(cacheKey) as CacheEntry<T> | undefined;
		if (entry && Date.now() < entry.expiresAt) return entry.value;
		const value = callback(...args);
		map.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
		return value;
	};
}

export function invalidateCache<A extends unknown[]>(key: string, ...args: A): void {
	const cacheKey = isSomeArray(args) ? `${key}:${JSON.stringify(args)}` : key;
	map.delete(cacheKey);
}

export function invalidateAllCache(): void {
	map.clear();
}

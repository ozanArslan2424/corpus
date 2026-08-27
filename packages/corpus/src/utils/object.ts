import type { OrString } from "@/utils/lexical";
import { isNil } from "@/utils/maybe";

export function createSafeObject<T = Record<string, unknown>>(): T {
	return Object.create(null);
}

export function objGetKeys<O extends object>(o: O): Array<keyof O> {
	return Object.keys(o) as Array<keyof O>;
}

export function objGetValues<O extends object>(o: O): Array<O[keyof O]> {
	return Object.values(o) as Array<O[keyof O]>;
}

export function objGetEntries<O extends object>(o: O): Array<[keyof O, O[keyof O]]> {
	return Object.entries(o) as Array<[keyof O, O[keyof O]]>;
}

export function objMerge<T extends object>(base: T, override: Partial<T>): T {
	const result = { ...base };

	for (const key of objGetKeys(override)) {
		const overrideVal = override[key];
		const baseVal = base[key];

		if (overrideVal === undefined || overrideVal === null) continue;

		if (
			typeof overrideVal === "object" &&
			!Array.isArray(overrideVal) &&
			typeof baseVal === "object" &&
			!Array.isArray(baseVal) &&
			baseVal !== null
		) {
			result[key] = objMerge(baseVal, overrideVal);
		} else {
			result[key] = overrideVal as T[keyof T];
		}
	}

	return result;
}

export function objAppendEntry(o: Record<string, unknown>, key: string, val: unknown) {
	const existing = o[key];
	if (existing !== undefined) {
		o[key] = Array.isArray(existing) ? [...existing, val] : [existing, val];
	} else {
		o[key] = val;
	}
}

type DiffOptions = {
	skipMethods?: boolean;
	skipKeys?: string[];
};

export type DiffResult = {
	unchanged: Array<{ key: string; val: unknown }>;
	changed: Array<{ key: string; prev: unknown; next: unknown }>;
	added: Array<{ key: string; val: unknown }>;
	removed: Array<{ key: string; val: unknown }>;
};

export function objToFlatMap(obj: object, prefix = ""): Map<string, unknown | undefined> {
	const map = new Map<string, unknown | undefined>();
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			for (const [nestedKey, nestedValue] of objToFlatMap(value, fullKey)) {
				map.set(nestedKey, nestedValue);
			}
		} else {
			map.set(fullKey, value);
		}
	}
	return map;
}

export function objDiff(source: object, target: object, options: DiffOptions = {}): DiffResult {
	const { skipMethods = false, skipKeys = [] } = options;

	const src = objToFlatMap(source);
	const tgt = objToFlatMap(target);

	// 1. was removed
	// 2. was changed
	// 3. was unchanged
	// 4. was added

	const result: DiffResult = { unchanged: [], changed: [], added: [], removed: [] };

	for (const [tgt_key, tgt_val] of tgt.entries()) {
		if (skipKeys.includes(tgt_key)) continue;
		if (skipMethods && typeof tgt_val === "function") continue;

		const src_val = src.get(tgt_key);

		const src_val_str = JSON.stringify(src_val);
		const tgt_val_str = JSON.stringify(tgt_val);

		const unchanged = src.has(tgt_key) && src_val_str === tgt_val_str;
		const changed = src.has(tgt_key) && src_val_str !== tgt_val_str;
		const added = !src.has(tgt_key);

		switch (true) {
			case unchanged:
				result.unchanged.push({ key: tgt_key, val: tgt_val });
				break;

			case changed:
				result.changed.push({ key: tgt_key, prev: src_val, next: tgt_val });
				break;

			case added:
				result.added.push({ key: tgt_key, val: tgt_val });
				break;
		}
	}

	for (const [src_key, src_val] of src.entries()) {
		if (skipKeys.includes(src_key)) continue;
		if (skipMethods && typeof src_val === "function") continue;

		const removed = !tgt.has(src_key);
		if (removed) {
			result.removed.push({ key: src_key, val: src_val });
		}
	}

	return result;
}

export function isObjectWith<T extends Record<string, unknown>>(
	item: unknown,
	key: OrString<keyof T>,
): item is T {
	return item !== null && item !== undefined && typeof item === "object" && key in item;
}

type DeepObjectWith<T> = T extends object ? { [K in keyof T]: DeepObjectWith<T[K]> } : T;

export function isDeepObjectWith<T extends Record<string, unknown>>(
	item: unknown,
	shape: T,
): item is DeepObjectWith<T> {
	const firstKey = Object.keys(shape)[0];
	if (!firstKey) return false;
	if (!isObjectWith<Record<string, unknown>>(item, firstKey)) return false;
	return Object.entries(shape).every(([key, value]) => {
		if (!isObjectWith<Record<string, unknown>>(item, key)) return false;
		if (typeof value === "object" && value !== null) {
			return isDeepObjectWith(item[key], value as Record<string, unknown>);
		}
		return true;
	});
}

export function isObjectWithKeys<T>(item: unknown, ...keys: string[]): item is T {
	let current = item;
	for (const key of keys) {
		if (!isObjectWith<Record<string, unknown>>(current, key)) return false;
		current = (current as Record<string, unknown>)[key];
	}
	return true;
}

export function isObject(input: unknown): input is Record<string, unknown> {
	if (isNil(input) || typeof input !== "object" || Array.isArray(input)) return false;
	return Object.getPrototypeOf(input) === Object.prototype;
}

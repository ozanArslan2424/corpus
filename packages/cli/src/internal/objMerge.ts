import type { Maybe } from "@/utils/is";

export function objMerge<T extends object>(base: T, override: Maybe<Partial<T>>): T {
	if (override === undefined || override === null) return base;

	const result = { ...base };

	for (const key of Object.keys(override)) {
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

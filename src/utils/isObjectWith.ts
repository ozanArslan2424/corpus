import type { OrString } from "@/utils/OrString";
import type { UnknownObject } from "@/utils/UnknownObject";

export function isObjectWith<T extends UnknownObject>(
	item: unknown,
	key: OrString<keyof T>,
): item is T {
	return (
		item !== null &&
		item !== undefined &&
		typeof item === "object" &&
		key in item
	);
}

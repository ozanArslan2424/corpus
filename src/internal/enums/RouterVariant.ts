import type { ValueOf } from "@/internal/utils/ValueOf";

export const RouterVariant = {
	array: "array",
	object: "object",
	map: "map",
} as const;

export type RouterVariant = ValueOf<typeof RouterVariant>;

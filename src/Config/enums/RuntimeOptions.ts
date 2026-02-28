import type { ValueOf } from "@/utils/types/ValueOf";

export const RuntimeOptions = {
	bun: "bun",
	node: "node",
} as const;

export type RuntimeOptions = ValueOf<typeof RuntimeOptions>;

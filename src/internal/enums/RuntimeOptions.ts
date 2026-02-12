import type { ValueOf } from "@/internal/utils/ValueOf";

export const RuntimeOptions = {
	bun: "bun",
	node: "node",
} as const;

export type RuntimeOptions = ValueOf<typeof RuntimeOptions>;

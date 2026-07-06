import type { ValueOf } from "@/utils/ValueOf";

export const MiddlewareVariant = {
	inbound: "inbound",
	outbound: "outbound",
} as const;

export type MiddlewareVariant = ValueOf<typeof MiddlewareVariant>;

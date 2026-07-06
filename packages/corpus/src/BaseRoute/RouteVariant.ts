import type { ValueOf } from "@/utils/ValueOf";

export const RouteVariant = {
	static: "static",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
} as const;

export type RouteVariant = ValueOf<typeof RouteVariant>;

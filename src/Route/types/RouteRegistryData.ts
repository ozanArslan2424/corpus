import type { AnyRoute } from "./AnyRoute";

export type RouteRegistryData = Pick<
	AnyRoute,
	"id" | "endpoint" | "method" | "pattern" | "handler"
>;

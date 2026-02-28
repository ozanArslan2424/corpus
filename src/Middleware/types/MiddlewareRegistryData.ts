import type { RouteId } from "../../Route/types/RouteId";
import type { MiddlewareHandler } from "@/Middleware/types/MiddlewareHandler";

export type MiddlewareRegistryData = {
	handler: MiddlewareHandler;
	order: number;
	routeId: RouteId | "*";
};

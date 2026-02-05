import type { Method } from "@/internal/Method/Method";
import type { Endpoint } from "@/internal/Route/Endpoint";

export type RouteDefinition = { method: Method; path: Endpoint } | Endpoint;

import type { Method } from "@/Method/Method";

export type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| { method: Method; path: E };

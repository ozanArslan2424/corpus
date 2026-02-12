import type { Method } from "@/internal/enums/Method";

import type { Endpoint } from "@/internal/types/Endpoint";

export type RouteDefinition<Path extends string = string> =
	| { method: Method; path: Endpoint<Path> }
	| Endpoint<Path>;

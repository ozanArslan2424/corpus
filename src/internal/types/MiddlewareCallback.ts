import type { RouteContextInterface } from "@/internal/modules/RouteContext/RouteContextInterface";

import type { MaybePromise } from "@/internal/types/MaybePromise";

export type MiddlewareCallback = (
	context: RouteContextInterface,
) => MaybePromise<RouteContextInterface | void>;

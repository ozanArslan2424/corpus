import type { RouteContextInterface } from "@/internal/modules/RouteContext/RouteContextInterface";

import type { MaybePromise } from "@/internal/types/MaybePromise";

export type RouteHandler<R = unknown, B = unknown, S = unknown, P = unknown> = (
	context: RouteContextInterface<B, S, P>,
) => MaybePromise<R>;

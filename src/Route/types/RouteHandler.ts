import type { Context } from "@/Context/Context";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type RouteHandler<B = unknown, S = unknown, P = unknown, R = unknown> = (
	context: Context<B, S, P, R>,
) => MaybePromise<R>;

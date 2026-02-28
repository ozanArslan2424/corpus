import type { Context } from "@/Context/Context";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type StaticRouteHandler<B = unknown, S = unknown, P = unknown> = (
	context: Context<B, S, P, string>,
	content: string,
) => MaybePromise<string>;

import type { Context } from "@/Context/Context";
import type { Func } from "@/utils/functions";

export type RouteCallback<B = unknown, S = unknown, P = unknown, R = unknown> = Func<
	[context: Context<B, S, P, R>],
	Bun.MaybePromise<R>
>;

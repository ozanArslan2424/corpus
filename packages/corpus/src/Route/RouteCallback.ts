import type { Func } from "@/utils/functions";

import type { Context } from "@/Context/Context";

export type RouteCallback<B = unknown, S = unknown, P = unknown, R = unknown> = Func<
	[context: Context<B, S, P, R>],
	Bun.MaybePromise<R>
>;

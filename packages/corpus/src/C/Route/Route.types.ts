import type { Func } from "@/utils";

import type { Context } from "@/C/Context/Context";

export type ContextHandler<B = unknown, S = unknown, P = unknown, R = unknown> = Func<
	[context: Context<B, S, P, R>],
	Bun.MaybePromise<R>
>;

import type { Context } from "@/Context/Context";
import type { Res } from "@/Res/Res";
import type { Func } from "@/utils/functions";

export type StaticRouteCallback<B = unknown, S = unknown, P = unknown> = Func<
	[context: Context<B, S, P, Res | string>, content: string],
	Bun.MaybePromise<Res | string>
>;

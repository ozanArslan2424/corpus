import type { Context } from "@/Context/Context";
import type { Res } from "@/Res/Res";
import type { Func } from "@/utils/functions";

export type MiddlewareHandler = Func<[context: Context], Bun.MaybePromise<void | Res>>;

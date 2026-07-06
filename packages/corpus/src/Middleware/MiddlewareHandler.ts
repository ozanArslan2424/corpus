import type { Func } from "@/utils/functions";

import type { Context } from "@/Context/Context";
import type { Res } from "@/Res/Res";

export type MiddlewareHandler = Func<[context: Context], Bun.MaybePromise<void | Res>>;

import type { Func } from "@/utils/functions";

import type { Context } from "@/Context/Context";
import type { Res } from "@/Res/Res";

export type ErrorHandler<R = unknown> = Func<[Error, Context], Bun.MaybePromise<Res<R>>>;

import type { Func } from "@/utils/functions";

import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";

export type RequestHandler<R = unknown> = Func<[Req], Bun.MaybePromise<Res<R>>>;

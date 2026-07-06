import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";
import type { Func } from "@/utils/functions";

export type RequestHandler<R = unknown> = Func<[Req], Bun.MaybePromise<Res<R>>>;

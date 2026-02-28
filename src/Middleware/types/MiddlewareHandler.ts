import type { Context } from "@/Context/Context";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type MiddlewareHandler = (context: Context) => MaybePromise<void>;

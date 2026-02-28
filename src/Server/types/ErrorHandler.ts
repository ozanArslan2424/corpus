import type { HttpResponse } from "@/Response/HttpResponse";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type ErrorHandler<R = unknown> = (
	err: Error,
) => MaybePromise<HttpResponse<R>>;

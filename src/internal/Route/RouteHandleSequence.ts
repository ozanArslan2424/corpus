import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";
import type { RouteContext } from "@/modules";
import type { MaybePromise } from "@/types/MaybePromise";

export type RouteHandleSequence<
	D = any,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> = {
	beforeCallback?: (
		context: RouteContext<D, R, B, S, P>,
	) => MaybePromise<RouteContext<D, R, B, S, P>>;
	afterCallback?: (
		context: RouteContext<D, R, B, S, P>,
		returnData: MaybePromise<R> | MaybePromise<CoreumResponse<R>>,
	) => MaybePromise<R> | MaybePromise<CoreumResponse<R>>;
};

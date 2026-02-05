import type { RouteContext } from "@/internal/Context/RouteContext";
import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";
import type { MaybePromise } from "@/types/MaybePromise";

export type RouteCallback<
	D = any,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> = (
	context: RouteContext<D, R, B, S, P>,
) => MaybePromise<R> | MaybePromise<CoreumResponse<R>>;

import type { RouteContext } from "@/internal/Context/RouteContext";
import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";

/**
 *  This takes in a regular request which is converted to Core.Req for types,
 * the context part is for the middlewares
 */
export type RouteHandler<
	D = any,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> = (
	req: Request,
	context?: RouteContext<D, R, B, S, P>,
) => Promise<CoreumResponse>;

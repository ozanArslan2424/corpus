import { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant } from "@/Route/types";

export abstract class RouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends BaseRoute<B, S, P, R, E> {
	override readonly variant: RouteVariant = RouteVariant.dynamic;
}

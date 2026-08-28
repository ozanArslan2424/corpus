import { RouteBase } from "@/C/RouteBase/RouteBase";

import { RouteVariant } from "../RouteBase/RouteVariant";

export abstract class RouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, R, E> {
	override readonly variant: RouteVariant = RouteVariant.dynamic;
}

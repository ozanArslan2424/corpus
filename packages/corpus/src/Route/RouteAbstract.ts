import type { Func } from "@/utils/functions";

import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import type { Context } from "@/Context/Context";
import type { RouteCallback } from "@/Route/RouteCallback";

export abstract class RouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends BaseRouteAbstract<B, S, P, R, E> {
	abstract callback: RouteCallback<B, S, P, R>;

	readonly variant: RouteVariant = RouteVariant.dynamic;

	get handler(): Func<[Context<B, S, P, R>], Bun.MaybePromise<R>> {
		return this.callback;
	}
}

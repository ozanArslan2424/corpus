import type { Context } from "@/C/Context/Context";
import type { Method } from "@/C/Method/Method";
import { RouteAbstract } from "@/C/Route/Route.abstract";
import type { ContextHandler } from "@/C/Route/Route.types";
import { resolveRouteAddress } from "@/C/RouteBase/resolveRouteAddress";
import type { RouteAddress, RouteModel } from "@/C/RouteBase/RouteBase.types";
import type { Func } from "@/utils";

export class Route<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends RouteAbstract<B, S, P, R, E> {
	constructor(
		address: RouteAddress<E>,
		callback: ContextHandler<B, S, P, R>,
		model?: RouteModel<B, S, P, R>,
	) {
		super();
		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.path;
		this.method = resolved.method;
		this.handler = callback;
		this.model = model;
		this.register();
	}

	override endpoint: E;
	override method: Method;
	override handler: Func<[context: Context<B, S, P, R>], Bun.MaybePromise<R>>;
}

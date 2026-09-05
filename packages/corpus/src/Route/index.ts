import type { ContextHandler } from "@/Context";
import { Method } from "@/Request";
import {
	resolveRouteAddress,
	RouteBase,
	RouteVariant,
	type RouteAddress,
	type RouteConfig,
} from "@/RouteBase";
import { assertDefined } from "@/utils/assert";

class Route<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, R, E> {
	constructor();
	constructor(
		address: RouteAddress<E>,
		callback: ContextHandler<B, S, P, R>,
		model?: RouteConfig<B, S, P, R>,
	);
	constructor(
		address?: RouteAddress<E>,
		callback?: ContextHandler<B, S, P, R>,
		model?: RouteConfig<B, S, P, R>,
	) {
		super();
		if (new.target !== Route) return;
		assertDefined(address, "address is required when Route is constructed directly.");
		assertDefined(callback, "callback is required when Route is constructed directly.");
		const addr = resolveRouteAddress(address);
		this.method = addr.method;
		this.endpoint = addr.endpoint;
		this.config = model;
		this.handler = callback;
		this.register();
	}

	readonly variant: RouteVariant = RouteVariant.dynamic;
	readonly method!: Method;
	readonly endpoint!: E;
	readonly config?: RouteConfig<B, S, P, R> = undefined;
	override handler!: ContextHandler<B, S, P, R>;
}

export { Route };

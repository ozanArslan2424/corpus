import type { RouteInterface } from "@/internal/modules/Route/RouteInterface";
import { RouteAbstract } from "@/internal/modules/Route/RouteAbstract";

/**
 * The object to define an endpoint. Can be instantiated with "new" or inside a controller
 * with {@link Controller.route}. The callback recieves the {@link RouteContext} and can
 * return {@link CoreumResponse} or any data. Route instantiation automatically registers
 * to the router.
 * */

export class Route<
	Path extends string = string,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
>
	extends RouteAbstract<Path, R, B, S, P>
	implements RouteInterface<Path, R, B, S, P> {}

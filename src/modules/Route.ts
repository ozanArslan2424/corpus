import { Route as _Route } from "@/internal/Route/Route";

/**
 * The object to define an endpoint. Can be instantiated with "new" or inside a controller
 * with {@link Controller.route}. The callback recieves the {@link Context} and can
 * return {@link Response} or object or nothing.
 * */

export const Route = _Route;
export type Route<
	D = undefined,
	R extends unknown = unknown,
	B extends unknown = unknown,
	S extends unknown = unknown,
	P extends unknown = unknown,
> = _Route<D, R, B, S, P>;

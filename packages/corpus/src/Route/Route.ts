import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import type { RouteAddress } from "@/BaseRoute/RouteAddress";
import type { RouteModel } from "@/BaseRoute/RouteModel";
import type { Method } from "@/C";
import { RouteAbstract } from "@/Route/RouteAbstract";
import type { RouteCallback } from "@/Route/RouteCallback";

/**
 * Defines an HTTP endpoint. Accepts a {@link RouteAddress} which can either be a plain
 * path string (defaults to GET) or an object with a `method` and `path` for other HTTP methods.
 *
 * The handler receives a {@link Context} and can return any data, a {@link Res} directly,
 * or a plain web `Response` for cases where full control over the response is needed.
 * Returned data is automatically serialized by {@link Res} — plain objects become JSON,
 * primitives become plain text, and so on.
 *
 * An optional {@link RouteModel} can be provided to validate and parse the request body,
 * URL params, and search params — the parsed results are typed and available on the context.
 *
 * Route instantiation automatically registers to the router.
 *
 * @example
 * // GET /users
 * new Route("/users", () => [{ id: 1 }]);
 *
 * // POST /users with typed body
 * new Route({ method: C.Method.POST, path: "/users" }, (c) => {
 *     return { created: c.body.name };
 * }, { body: UserModel });
 */

export class Route<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends RouteAbstract<B, S, P, R, E> {
	constructor(
		address: RouteAddress<E>,
		callback: RouteCallback<B, S, P, R>,
		model?: RouteModel<B, S, P, R>,
	) {
		super();
		const resolved = BaseRouteAbstract.resolveAddress(address);
		this.endpoint = resolved.path;
		this.method = resolved.method;
		this.callback = callback;
		this.model = model;
		this.register();
	}

	override callback: RouteCallback<B, S, P, R>;
	override endpoint: E;
	override method: Method;
}

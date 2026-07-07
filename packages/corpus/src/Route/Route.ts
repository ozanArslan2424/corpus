import type { Context } from "@/Context/Context";
import type { Method } from "@/enums/Method";
import { resolveRouteAddress } from "@/Route/resolveRouteAddress";
import { RouteAbstract } from "@/Route/RouteAbstract";
import type { RouteAddress, RouteModel } from "@/Route/types";
import type { Func } from "@/utils/functions";

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
		callback: Func<[context: Context<B, S, P, R>], Bun.MaybePromise<R>>,
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

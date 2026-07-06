import { joinPathSegments } from "@/utils/joinPathSegments";

import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import type { MiddlewareHandler } from "@/Middleware/MiddlewareHandler";
import { Route } from "@/Route/Route";
import { StaticRoute } from "@/StaticRoute/StaticRoute";
import { WebSocketRoute } from "@/WebSocketRoute/WebSocketRoute";

/**
 * Base class for grouping related routes under a shared prefix and optional middleware.
 * Extend this class to create your own controllers.
 *
 * All routes registered via {@link Controller.route} and {@link Controller.staticRoute}
 * automatically inherit the controller's prefix and run `beforeEach` before the handler if set.
 *
 * @example
 * class UserController extends ControllerAbstract {
 *     constructor() {
 *         super({ prefix: "/users" });
 *     }
 *
 *     getAll = this.route("/", () => getAllUsers());
 *
 *     create = this.route({ method: C.Method.POST, path: "/" }, (c) => createUser(c.body));
 *
 *     avatar = this.staticRoute("/avatar", { filePath: "assets/avatar.png", stream: true });
 * }
 *
 * new UserController();
 */

export abstract class Controller {
	readonly routeIds: Set<string> = new Set<string>();

	abstract prefix?: string;
	beforeEach?: MiddlewareHandler;

	/**
	 * Registers a dynamic route under this controller. Behaves identically to {@link Route}
	 * but automatically prepends the controller prefix and runs `beforeEach` before the handler.
	 */
	protected route<B = unknown, S = unknown, P = unknown, R = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof Route<B, S, P, R, E>>
	): Route<B, S, P, R, E> {
		const [address, handler, model] = args;
		const resolved = BaseRouteAbstract.resolveAddress(address);
		const method = resolved.method;
		const path = joinPathSegments<E>(this.prefix, resolved.path);
		const route = new Route(
			{ method, path },
			async (ctx) => {
				await this.beforeEach?.(ctx);
				return handler(ctx);
			},
			model,
		);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a static file route under this controller. Behaves identically to {@link StaticRoute}
	 * but automatically prepends the controller prefix.
	 */
	protected staticRoute<B = unknown, S = unknown, P = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof StaticRoute<B, S, P, E>>
	): StaticRoute<B, S, P, E> {
		const [address, ...rest] = args;
		const resolved = BaseRouteAbstract.resolveAddress(address);
		const method = resolved.method;
		const path = joinPathSegments<E>(this.prefix, resolved.path);
		const route = new StaticRoute({ method, path }, ...rest);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a websocket route under this controller. Behaves identically to {@link WebSocketRoute}
	 * but automatically prepends the controller prefix.
	 */
	protected websocketRoute<E extends string = string>(
		...args: ConstructorParameters<typeof WebSocketRoute<E>>
	) {
		const [path, ...rest] = args;
		const endpoint = joinPathSegments<E>(this.prefix, path);
		const route = new WebSocketRoute(endpoint, ...rest);
		this.routeIds.add(route.id);
		return route;
	}
}

import { FileRoute } from "@/C/FileRoute/FileRoute";
import { Route } from "@/C/Route/Route";
import type { ContextHandler } from "@/C/Route/Route.types";
import { joinPathSegments } from "@/C/RouteBase/joinPathSegments";
import { resolveRouteAddress } from "@/C/RouteBase/resolveRouteAddress";
import { StaticRoute } from "@/C/StaticRoute/StaticRoute";
import { WebSocketRoute } from "@/C/WebSocketRoute/WebSocketRoute";
import type { Optional, WithPrefix } from "@/utils";

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

export class Controller<Px extends Optional<string> = Optional<string>> {
	constructor(public prefix?: Px) {}

	readonly routeIds: Set<string> = new Set<string>();

	beforeEach?: ContextHandler;

	/**
	 * Registers a dynamic route under this controller. Behaves identically to {@link Route}
	 * but automatically prepends the controller prefix and runs `beforeEach` before the handler.
	 */
	route<B = unknown, S = unknown, P = unknown, R = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof Route<B, S, P, R, E>>
	): Route<B, S, P, R, WithPrefix<Px, E>> {
		const [address, handler, model] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const path = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.path);
		const route = new Route<B, S, P, R, WithPrefix<Px, E>>(
			{ method, path },
			async (ctx) => {
				await this.beforeEach?.(ctx);
				return await handler(ctx);
			},
			model,
		);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a static route under this controller. Behaves identically to {@link StaticRoute}
	 * but automatically prepends the controller prefix.
	 */
	staticRoute<B = unknown, S = unknown, P = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof StaticRoute<B, S, P, E>>
	): StaticRoute<B, S, P, WithPrefix<Px, E>> {
		const [address, filePath, callback, model] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const path = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.path);
		const route = new StaticRoute<B, S, P, WithPrefix<Px, E>>(
			{ method, path },
			filePath,
			callback === undefined
				? undefined
				: async (ctx, content) => {
						await this.beforeEach?.(ctx);
						return await callback(ctx, content);
					},
			model,
		);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a file route under this controller. Behaves identically to {@link FileRoute}
	 * but automatically prepends the controller prefix.
	 */
	fileRoute<E extends string = string>(
		...args: ConstructorParameters<typeof FileRoute<E>>
	): FileRoute<WithPrefix<Px, E>> {
		const [address, definition] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const path = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.path);
		const route = new FileRoute<WithPrefix<Px, E>>({ method, path }, definition);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a websocket route under this controller. Behaves identically to {@link WebSocketRoute}
	 * but automatically prepends the controller prefix.
	 */
	websocketRoute<E extends string = string>(
		...args: ConstructorParameters<typeof WebSocketRoute<E>>
	): WebSocketRoute<WithPrefix<Px, E>> {
		const [path, ...rest] = args;
		const endpoint = joinPathSegments<WithPrefix<Px, E>>(this.prefix, path);
		const route = new WebSocketRoute<WithPrefix<Px, E>>(endpoint, ...rest);
		this.routeIds.add(route.id);
		return route;
	}
}

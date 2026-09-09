/**
 * Grouping for routes that share a path prefix and a common preamble.
 *
 * A {@link Controller} is a thin factory: each method constructs the
 * corresponding {@link RouteBase} subclass with the prefix already joined on,
 * records its id, and returns it. The routes are ordinary routes registered on
 * the nearest {@link App} exactly as if they had been constructed directly —
 * a controller adds no dispatch layer of its own.
 *
 * ```ts
 * import { Controller } from "@ozanarslan/corpus";
 *
 * const users = new Controller("/users");
 * users.beforeEach = (c) => authenticate(c);
 *
 * users.route("GET /:id", (c) => findUser(c.params.id));
 * ```
 *
 * @module Controller
 */

import type { ContextHandler } from "@/Context";
import { resolveRouteAddress } from "@/RouteBase";
import { BundleRoute } from "@/RouteBase/BundleRoute";
import { FileRoute } from "@/RouteBase/FileRoute";
import { Route } from "@/RouteBase/Route";
import { StaticRoute } from "@/RouteBase/StaticRoute";
import { WebSocketRoute } from "@/RouteBase/WebSocketRoute";
import type { Optional } from "@/utils/maybe";
import { joinPathSegments, type WithPrefix } from "@/utils/path";

/**
 * Registers routes under a shared path prefix.
 *
 * Every method mirrors the constructor of the route class it creates, so moving
 * a route into a controller means changing the call site and nothing else. The
 * prefix is folded into the endpoint at construction time and into the endpoint
 * *type* through {@link WithPrefix}, so the returned route stays as narrowly
 * typed as one written out by hand.
 *
 * {@link Controller.beforeEach} runs ahead of the handler for the route kinds
 * that have a user-supplied handler — {@link Controller.route} and
 * {@link Controller.staticRoute}. The other kinds resolve their responses
 * internally and are unaffected.
 *
 * {@link Controller.routeIds} makes the group addressable afterwards, which is
 * how a {@link Middleware} can be attached to every route in a controller at
 * once.
 *
 * @typeParam Px - The literal prefix type, carried into every endpoint type the
 * controller produces.
 */
class Controller<Px extends Optional<string> = Optional<string>> {
	/**
	 * Creates a controller.
	 *
	 * @param prefix - Path segment prepended to every endpoint registered through
	 * this controller. Omit it to group routes without changing their paths — the
	 * shared {@link Controller.beforeEach} and {@link Controller.routeIds} still
	 * apply.
	 */
	constructor(public prefix?: Px) {}

	/**
	 * Ids of every {@link RouteBase} registered through this controller, in the
	 * order they were created.
	 *
	 * Pass them to a {@link Middleware} to target the whole group:
	 *
	 * ```ts
	 * new Middleware([...users.routeIds], handler);
	 * ```
	 */
	readonly routeIds: Set<string> = new Set<string>();

	/**
	 * Runs before the handler of every {@link Controller.route} and
	 * {@link Controller.staticRoute} created by this controller.
	 *
	 * Its return value is discarded — this is for side effects on the
	 * {@link Context}, such as authenticating a request or populating
	 * {@link Context.data}. Throwing here aborts the request before the handler
	 * runs, which is the intended way to reject one.
	 *
	 * Assign it before registering routes: each route captures the controller, not
	 * the function, but a route registered while it is unset still checks it at
	 * request time. For behaviour that must wrap the response as well as precede
	 * it, use a {@link Middleware} targeting {@link Controller.routeIds} instead.
	 */
	beforeEach?: ContextHandler;

	/**
	 * Registers a dynamic route under this controller. Behaves identically to {@link Route}
	 * but automatically prepends the controller prefix and runs `beforeEach` before the handler.
	 *
	 * @param args - The {@link Route} constructor arguments: the route address
	 * (a `"METHOD /endpoint"` string or a method/endpoint pair), the
	 * {@link ContextHandler}, and an optional {@link RouteConfig}.
	 * @returns The registered {@link Route}, its endpoint type prefixed.
	 * @typeParam B - Parsed {@link Context.body} type.
	 * @typeParam S - Parsed {@link Context.search} type.
	 * @typeParam P - Parsed {@link Context.params} type.
	 * @typeParam R - Response body type.
	 * @typeParam E - The endpoint literal, before the prefix is applied.
	 */
	route<B = unknown, S = unknown, P = unknown, R = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof Route<B, S, P, R, E>>
	): Route<B, S, P, R, WithPrefix<Px, E>> {
		const [address, handler, model] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const endpoint = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.endpoint);
		const route = new Route<B, S, P, R, WithPrefix<Px, E>>(
			{ method, endpoint },
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
	 *
	 * {@link Controller.beforeEach} runs only when a callback is supplied, since
	 * that is where the controller has a handler to wrap; a static route that just
	 * serves its file is left alone.
	 *
	 * @param args - The {@link StaticRoute} constructor arguments: the route
	 * address, the file path, an optional callback receiving the
	 * {@link Context} and the file contents, and an optional
	 * {@link RouteConfig}.
	 * @returns The registered {@link StaticRoute}, its endpoint type prefixed.
	 * @typeParam B - Parsed {@link Context.body} type.
	 * @typeParam S - Parsed {@link Context.search} type.
	 * @typeParam P - Parsed {@link Context.params} type.
	 * @typeParam E - The endpoint literal, before the prefix is applied.
	 */
	staticRoute<B = unknown, S = unknown, P = unknown, E extends string = string>(
		...args: ConstructorParameters<typeof StaticRoute<B, S, P, E>>
	): StaticRoute<B, S, P, WithPrefix<Px, E>> {
		const [address, filePath, callback, model] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const endpoint = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.endpoint);
		const route = new StaticRoute<B, S, P, WithPrefix<Px, E>>(
			{ method, endpoint },
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
	 *
	 * {@link Controller.beforeEach} does not apply: a file route resolves its
	 * response internally and takes no handler to wrap.
	 *
	 * @param args - The {@link FileRoute} constructor arguments: the route address
	 * and the file definition.
	 * @returns The registered {@link FileRoute}, its endpoint type prefixed.
	 * @typeParam E - The endpoint literal, before the prefix is applied.
	 */
	fileRoute<E extends string = string>(
		...args: ConstructorParameters<typeof FileRoute<E>>
	): FileRoute<WithPrefix<Px, E>> {
		const [address, definition] = args;
		const resolved = resolveRouteAddress(address);
		const method = resolved.method;
		const endpoint = joinPathSegments<WithPrefix<Px, E>>(this.prefix, resolved.endpoint);
		const route = new FileRoute<WithPrefix<Px, E>>({ method, endpoint }, definition);
		this.routeIds.add(route.id);
		return route;
	}

	/**
	 * Registers a websocket route under this controller. Behaves identically to {@link WebSocketRoute}
	 * but automatically prepends the controller prefix.
	 *
	 * The address is a plain endpoint rather than a method-and-endpoint pair, since
	 * an upgrade is always a {@link Method.GET}.
	 * {@link Controller.beforeEach} does not apply — the socket lifecycle
	 * callbacks are not a {@link ContextHandler}.
	 *
	 * @param args - The {@link WebSocketRoute} constructor arguments: the endpoint
	 * followed by the socket lifecycle callbacks.
	 * @returns The registered {@link WebSocketRoute}, its endpoint type prefixed.
	 * @typeParam E - The endpoint literal, before the prefix is applied.
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

	/**
	 * Registers a bundle route under this controller. Behaves identically to {@link BundleRoute}
	 * but automatically prepends the controller prefix.
	 *
	 * {@link Controller.beforeEach} does not apply: a bundle route resolves files
	 * internally and takes no handler to wrap.
	 *
	 * @param args - The {@link BundleRoute} constructor arguments: the endpoint,
	 * the directory to serve, and an optional {@link BundleRouteDefinition}.
	 * @returns The registered {@link BundleRoute}, its endpoint type prefixed.
	 * @typeParam E - The endpoint literal, before the prefix is applied.
	 */
	bundleRoute<E extends string = string>(
		...args: ConstructorParameters<typeof BundleRoute<E>>
	): BundleRoute<WithPrefix<Px, E>> {
		const [endpoint, dir, definition] = args;
		const resolvedEndpoint = joinPathSegments<WithPrefix<Px, E>>(this.prefix, endpoint);
		const route = new BundleRoute<WithPrefix<Px, E>>(resolvedEndpoint, dir, definition);
		this.routeIds.add(route.id);
		return route;
	}
}

export { Controller };

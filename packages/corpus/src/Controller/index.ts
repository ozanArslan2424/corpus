import { BundleRoute } from "@/BundleRoute";
import type { ContextHandler } from "@/Context";
import { FileRoute } from "@/FileRoute";
import { Route } from "@/Route";
import { resolveRouteAddress } from "@/RouteBase";
import { StaticRoute } from "@/StaticRoute";
import type { Optional } from "@/utils/maybe";
import { joinPathSegments, type WithPrefix } from "@/utils/path";
import { WebSocketRoute } from "@/WebSocketRoute";

class Controller<Px extends Optional<string> = Optional<string>> {
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

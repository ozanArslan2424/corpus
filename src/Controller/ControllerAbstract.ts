import { Route } from "@/Route/Route";
import { StaticRoute } from "@/Route/StaticRoute";
import type { ControllerOptions } from "@/Controller/types/ControllerOptions";
import type { MiddlewareHandler } from "@/Middleware/types/MiddlewareHandler";
import type { RouteId } from "@/Route/types/RouteId";
import { joinPathSegments } from "@/utils/joinPathSegments";
import type { RouteDefinition } from "@/Route/types/RouteDefinition";

/** Extend this class to create your own controllers. */

export abstract class ControllerAbstract {
	constructor(opts?: ControllerOptions) {
		this.prefix = opts?.prefix;
		this.beforeEach = opts?.beforeEach;
	}

	routeIds: Set<RouteId> = new Set<RouteId>();
	protected prefix?: string;
	protected beforeEach?: MiddlewareHandler;

	protected route<
		Path extends string = string,
		B = unknown,
		S = unknown,
		P = unknown,
		R = unknown,
	>(
		...args: ConstructorParameters<typeof Route<Path, B, S, P, R>>
	): Route<Path, B, S, P, R> {
		const [definition, handler, model] = args;

		const route = new Route(
			this.resolveRouteDefinition(definition),
			async (ctx) => {
				await this.beforeEach?.(ctx);
				return handler(ctx);
			},
			model,
		);
		this.routeIds.add(route.id);
		return route;
	}

	protected staticRoute<
		Path extends string = string,
		B = unknown,
		S = unknown,
		P = unknown,
	>(
		...args: ConstructorParameters<typeof StaticRoute<Path, B, S, P>>
	): StaticRoute<Path, B, S, P> {
		const [path, filePath, handler, model] = args;
		const route = new StaticRoute(
			joinPathSegments<Path>(this.prefix, path),
			filePath,
			handler,
			model,
		);
		this.routeIds.add(route.id);
		return route;
	}

	private resolveRouteDefinition<Path extends string = string>(
		definition: RouteDefinition<Path>,
	): RouteDefinition<Path> {
		if (typeof definition === "string") {
			return joinPathSegments<Path>(this.prefix, definition);
		}

		return {
			method: definition.method,
			path: joinPathSegments(this.prefix, definition.path),
		};
	}
}

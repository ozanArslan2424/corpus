import { Method } from "@/internal/Method/Method";
import type { MiddlewareCallback } from "@/internal/Middleware/MiddlewareCallback";
import { Route } from "@/internal/Route/Route";
import type { RouteCallback } from "@/internal/Route/RouteCallback";
import type { RouteDefinition } from "@/internal/Route/RouteDefinition";
import type { RouteSchemas } from "@/internal/Route/RouteSchemas";

export class Service {
	protected makeMiddlewareHandler<D = void>(callback: MiddlewareCallback<D>) {
		return callback;
	}

	protected makeRouteHandler<
		D = void,
		R extends unknown = unknown,
		B extends unknown = unknown,
		S extends unknown = unknown,
		P extends unknown = unknown,
	>(
		definition: RouteDefinition,
		callback: RouteCallback<D, R, B, S, P>,
		schemas?: RouteSchemas<R, B, S, P>,
	): Route<D, R, B, S, P> {
		if (typeof definition === "string") {
			definition = { method: Method.GET, path: definition };
		} else {
			definition = { method: definition.method, path: definition.path };
		}
		const route = new Route<D, R, B, S, P>(
			definition.method,
			definition.path,
			callback,
			schemas,
		);
		return route;
	}
}

import { Method } from "@/internal/Method/Method";
import { getGlobalPrefix } from "@/internal/globalPrefix/getGlobalPrefix";
import { Route } from "@/internal/Route/Route";
import type { RouteCallback } from "@/internal/Route/RouteCallback";
import type { RouteDefinition } from "@/internal/Route/RouteDefinition";
import type { RouteSchemas } from "@/internal/Route/RouteSchemas";
import { textIsDefined } from "@/utils/textIsDefined";
import { joinPathSegments } from "@/utils/joinPathSegments";
import type { RouteHandleSequence } from "@/internal/Route/RouteHandleSequence";
import type { MaybePromise } from "@/types/MaybePromise";
import type { RouteContext } from "@/internal/Context/RouteContext";

export class Controller {
	constructor(
		private readonly prefix?: string,
		private readonly beforeEach?: <
			D = any,
			R = unknown,
			B = unknown,
			S = unknown,
			P = unknown,
		>(
			context: RouteContext<D, R, B, S, P>,
		) => MaybePromise<RouteContext<D, R, B, S, P>>,
	) {}

	readonly routes: Route<any, any, any, any, any>[] = [];

	route<D, R, B, S, P>(
		definition: RouteDefinition,
		callback: RouteCallback<D, R, B, S, P>,
		schemas?: RouteSchemas<R, B, S, P>,
		sequence?: RouteHandleSequence<D, R, B, S, P>,
	): Route<D, R, B, S, P> {
		const method = this.getMethod(definition);
		const path = this.getPath(definition);
		definition = { method, path };
		const organizedSequence = this.getOrganizedSequence(sequence);

		const route = new Route<D, R, B, S, P>(
			method,
			path,
			callback,
			schemas,
			organizedSequence,
		);

		this.routes.push(route);

		return route;
	}

	private getMethod(def: RouteDefinition) {
		return typeof def === "string" ? Method.GET : def.method;
	}

	private getPath(def: RouteDefinition) {
		const rawPath = typeof def === "string" ? def : def.path;

		const globalPrefix = getGlobalPrefix();

		return textIsDefined(globalPrefix)
			? joinPathSegments(globalPrefix, this.prefix, rawPath)
			: joinPathSegments(this.prefix, rawPath);
	}

	private getOrganizedSequence<D, R, B, S, P>(
		sequence?: RouteHandleSequence<D, R, B, S, P>,
	): RouteHandleSequence<D, R, B, S, P> {
		return {
			beforeCallback: async (ctx) => {
				if (this.beforeEach) {
					ctx = await this.beforeEach(ctx);
				}
				if (sequence?.beforeCallback) {
					ctx = await sequence.beforeCallback(ctx);
				}
				return ctx;
			},
			afterCallback: sequence?.afterCallback,
		};
	}
}

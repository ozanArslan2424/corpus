import type { ControllerInterface } from "@/modules/Controller/ControllerInterface";
import type { RouteInterface } from "@/modules/Route/RouteInterface";
import { Route } from "@/modules/Route/Route";
import type { ControllerOptions } from "@/modules/Controller/types/ControllerOptions";
import type { RouteHandler } from "@/modules/Route/types/RouteHandler";
import type { RouteDefinition } from "@/modules/Route/types/RouteDefinition";
import type { RouteSchemas } from "@/modules/Parser/types/RouteSchemas";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { textIsDefined } from "@/utils/textIsDefined";
import { createHash } from "@/utils/createHash";
import { getServerInstance } from "@/modules/Server/ServerInstance";
import { Method } from "@/modules/HttpRequest/enums/Method";

/** Extend this class to create your own controllers. */

export abstract class ControllerAbstract<
	Prefix extends string = string,
> implements ControllerInterface {
	constructor(private readonly opts?: ControllerOptions<Prefix>) {}

	get id(): string {
		const input = [this.constructor.name];
		if (this.prefix) input.push(this.prefix);
		return createHash(...input);
	}

	get prefix(): string | undefined {
		const globalPrefix = getServerInstance().router.globalPrefix;
		if (textIsDefined(globalPrefix)) {
			return joinPathSegments(globalPrefix, this.opts?.prefix);
		}
		return this.opts?.prefix;
	}

	route<
		Path extends string = string,
		B = unknown,
		R = unknown,
		S = unknown,
		P = unknown,
	>(
		definition: RouteDefinition<Path>,
		handler: RouteHandler<B, R, S, P>,
		schemas?: RouteSchemas<B, R, S, P>,
	): RouteInterface<Path, B, R, S, P> {
		return new Route(
			this.resolveRouteDefinition(definition),
			async (ctx) => {
				await this.opts?.beforeEach?.(ctx);
				return handler(ctx);
			},
			schemas,
			this.id,
		);
	}

	protected resolveRouteDefinition<Path extends string = string>(
		definition: RouteDefinition<Path>,
	): RouteDefinition<Path> {
		const path = typeof definition === "string" ? definition : definition.path;
		const method =
			typeof definition === "string" ? Method.GET : definition.method;

		if (textIsDefined(this.prefix)) {
			return { method, path: joinPathSegments(this.prefix, path) };
		}

		return { method, path };
	}
}

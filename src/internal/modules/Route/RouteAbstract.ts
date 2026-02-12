import { Method } from "@/internal/enums/Method";
import { getGlobalPrefix } from "@/internal/global/globalPrefix";
import type { RouteInterface } from "@/internal/modules/Route/RouteInterface";
import type { RouteId } from "@/internal/types/RouteId";
import type { Endpoint } from "@/internal/types/Endpoint";
import type { RouteHandler } from "@/internal/types/RouteHandler";
import type { RouteSchemas } from "@/internal/types/RouteSchemas";
import { joinPathSegments } from "@/internal/utils/joinPathSegments";
import { textIsDefined } from "@/internal/utils/textIsDefined";
import { getServerInstance } from "@/internal/global/ServerInstance";
import type { RouteDefinition } from "@/internal/types/RouteDefinition";

export abstract class RouteAbstract<
	Path extends string = string,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> implements RouteInterface<Path, R, B, S, P> {
	constructor(
		private readonly definition: RouteDefinition<Path>,
		handler: RouteHandler<R, B, S, P>,
		readonly model?: RouteSchemas<R, B, S, P>,
		readonly controllerId?: string,
	) {
		this.handler = handler;
		getServerInstance().router.addRoute(this);
	}

	handler: RouteHandler<R, B, S, P>;

	get path(): Endpoint<Path> {
		const endpoint =
			typeof this.definition === "string"
				? this.definition
				: this.definition.path;
		const globalPrefix = getGlobalPrefix();
		if (textIsDefined(globalPrefix) && !endpoint.startsWith(globalPrefix)) {
			return joinPathSegments(globalPrefix, endpoint);
		}
		return endpoint;
	}

	get method(): Method {
		return typeof this.definition === "string"
			? Method.GET
			: this.definition.method;
	}

	get pattern(): RegExp {
		// Convert route pattern to regex: "/users/:id" -> /^\/users\/([^\/]+)$/
		const regex = this.path
			.split("/")
			.map((part) => (part.startsWith(":") ? "([^\\/]+)" : part))
			.join("/");
		const pattern = new RegExp(`^${regex}$`);
		return pattern;
	}

	get id(): RouteId {
		return `[${this.method}]:[${this.path}]`;
	}
}

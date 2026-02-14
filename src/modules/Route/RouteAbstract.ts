import type { RouteInterface } from "@/modules/Route/RouteInterface";
import type { RouteId } from "@/modules/Route/types/RouteId";
import type { RouteHandler } from "@/modules/Route/types/RouteHandler";
import type { RouteSchemas } from "@/modules/Parser/types/RouteSchemas";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { textIsDefined } from "@/utils/textIsDefined";
import type { RouteDefinition } from "@/modules/Route/types/RouteDefinition";
import { getServerInstance } from "@/modules/Server/ServerInstance";
import { Method } from "@/modules/HttpRequest/enums/Method";

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
		readonly schemas?: RouteSchemas<R, B, S, P>,
		readonly controllerId?: string,
	) {
		this.handler = handler;
		getServerInstance().router.addRoute(this);
	}

	handler: RouteHandler<R, B, S, P>;

	get path(): Path {
		const endpoint =
			typeof this.definition === "string"
				? this.definition
				: this.definition.path;
		const globalPrefix = getServerInstance().router.globalPrefix;
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
		return new RegExp(`^${regex}$`);
	}

	get id(): RouteId {
		return `[${this.method}]:[${this.path}]`;
	}
}

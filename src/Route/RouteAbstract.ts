import { Method } from "@/Request/enums/Method";
import { RouteVariant } from "@/Route/enums/RouteVariant";
import { Config } from "@/Config/Config";
import { Route } from "@/Route/Route";
import type { RouteDefinition } from "@/Route/types/RouteDefinition";
import type { RouteHandler } from "@/Route/types/RouteHandler";
import type { RouteId } from "@/Route/types/RouteId";
import type { RouteModel } from "@/Model/types/RouteModel";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { _globalPrefixEnvKey } from "@/Config/constants/_globalPrefixEnvKey";

export abstract class RouteAbstract<
	Path extends string = string,
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
> {
	abstract variant: RouteVariant;
	abstract endpoint: Path;
	abstract method: Method;
	abstract pattern: RegExp;
	abstract id: RouteId;
	abstract handler: RouteHandler<B, S, P, R>;
	abstract model?: RouteModel<B, S, P, R>;

	resolveEndpoint(
		definition: RouteDefinition<Path>,
		variant: RouteVariant,
	): Path {
		const endpoint =
			typeof definition === "string" ? definition : definition.path;
		if (variant === RouteVariant.dynamic) {
			return joinPathSegments(
				Config.get(_globalPrefixEnvKey, { fallback: "" }),
				endpoint,
			);
		}
		return endpoint;
	}

	resolveMethod(definition: RouteDefinition<Path>): Method {
		return typeof definition === "string" ? Method.GET : definition.method;
	}

	resolvePattern(endpoint: Path): RegExp {
		// Convert route pattern to regex: "/users/:id" -> /^\/users\/([^\/]+)$/
		const regex = endpoint
			.split("/")
			.map((part) => (part.startsWith(":") ? "([^\\/]+)" : part))
			.join("/");
		return new RegExp(`^${regex}$`);
	}

	resolveId(method: Method, endpoint: Path): RouteId {
		return Route.makeRouteId(method, endpoint);
	}
}

import { $registry } from "@/registry";
import type { RouterInterface, RouterAdapterInterface } from "@/Registry/types";
import type { Req } from "@/Req/Req";
import type { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant } from "@/Route/types";
import type { RouterReturn } from "@/Router/types";
import type { RouterData } from "@/Router/types";
import { arrIncludes } from "@/utils/arrays";
import type { Func } from "@/utils/functions";
import { internFunc } from "@/utils/functions";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { logger } from "@/utils/logger";
import { objGetEntries } from "@/utils/objects";
import { strRemoveWhitespace } from "@/utils/strings";

export class Router implements RouterInterface {
	constructor(private readonly adapter: RouterAdapterInterface) {}

	private readonly cache = new WeakMap<Req, RouterReturn>();
	private readonly funcMap = new Map<string, Func>();

	add(route: BaseRoute<any, any, any, any>): void {
		const data = this.routeToRouterData(route);
		this.adapter.add(data);
		$registry.docs.set(data.id, {
			id: data.id,
			endpoint: data.endpoint,
			method: data.method,
			model: route.model,
		});
	}

	find(req: Req): RouterReturn | null {
		const match = this.cache.get(req) ?? this.adapter.find(req);
		if (!match) return null;
		this.cache.set(req, match);
		return match;
	}

	list(): Array<RouterData> {
		const fn = this.adapter.list;
		if (!fn) {
			logger.warn("Router adapter does not support list method, returning empty array");
			return [];
		}
		return fn();
	}

	private routeToRouterData(route: BaseRoute): RouterData {
		const data: RouterData = {
			id: route.id,
			endpoint: route.endpoint,
			method: route.method,
			handler: route.handler,
			variant: route.variant,
		};

		if (arrIncludes(data.variant, [RouteVariant.dynamic, RouteVariant.websocket])) {
			data.endpoint = joinPathSegments($registry.prefix, route.endpoint);
		}

		if (route.model) {
			data.validators ??= {};
			for (const [key, schema] of objGetEntries(route.model)) {
				if (key === "response") continue;
				if (!schema) continue;
				data.validators[key] = internFunc(
					this.funcMap,
					schema["~standard"].validate,
					"model",
					strRemoveWhitespace(JSON.stringify(schema)),
				);
			}
		}

		return data;
	}
}

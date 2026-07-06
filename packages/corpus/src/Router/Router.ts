import { arrIncludes } from "@/utils/arrays";
import type { Func } from "@/utils/functions";
import { internFunc } from "@/utils/functions";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { logger } from "@/utils/logger";
import { objGetKeys } from "@/utils/objects";
import { strRemoveWhitespace } from "@/utils/strings";

import type { BaseRouteInterface } from "@/BaseRoute/BaseRouteInterface";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { $registry } from "@/index";
import type { Req } from "@/Req/Req";
import type { RouterData } from "@/Router/RouterData";
import type { RouterInterface } from "@/Router/RouterInterface";
import type { RouterReturn } from "@/Router/RouterReturn";
import type { RouterAdapterInterface } from "@/RouterAdapter/RouterAdapterInterface";

export class Router implements RouterInterface {
	constructor(private readonly adapter: RouterAdapterInterface) {}

	private readonly cache = new WeakMap<Req, RouterReturn>();
	private readonly funcMap = new Map<string, Func>();

	add(route: BaseRouteInterface<any, any, any, any>): void {
		const data = this.routeToRouterData(route);
		if (route.model) {
			data.model ??= {};
			for (const key of objGetKeys(route.model)) {
				if (key === "response") continue;
				const schema = route.model[key];
				if (!schema) continue;
				data.model[key] = internFunc(
					this.funcMap,
					schema["~standard"].validate,
					"model",
					strRemoveWhitespace(JSON.stringify(schema)),
				);
			}
		}
		this.adapter.add(data);
		$registry.docs.set(route.id, {
			id: route.id,
			endpoint: route.endpoint,
			method: route.method,
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

	private routeToRouterData(route: BaseRouteInterface): RouterData {
		let endpoint = route.endpoint;
		if (arrIncludes(route.variant, [RouteVariant.dynamic, RouteVariant.websocket])) {
			endpoint = joinPathSegments($registry.prefix, route.endpoint);
		}

		return {
			id: route.id,
			endpoint,
			method: route.method,
			handler: route.handler,
			variant: route.variant,
		};
	}
}

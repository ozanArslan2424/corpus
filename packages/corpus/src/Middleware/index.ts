import { getNearestApp } from "@/AppsRegistry";
import type { Context } from "@/Context";
import type { Controller } from "@/Controller";
import type { RouteBase } from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isString, type OrString } from "@/utils/lexical";
import type { MaybePromise } from "@/utils/maybe";

type MiddlewareHandler<R = unknown> = (
	context: Context,
	next: () => MaybePromise<R>,
) => MaybePromise<R>;

type MiddlewareUseOn =
	| Array<RouteBase | Controller | string>
	| RouteBase
	| Controller
	| OrString<"*">;

type MiddlewareDefinition = {
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

class Middleware {
	constructor();
	constructor(definition: MiddlewareDefinition);
	constructor(definition?: MiddlewareDefinition) {
		if (new.target !== Middleware) return;
		const msg = "Middleware must be constructed with (definition) or extended.";
		assertDefined(definition, msg);

		this.useOn = definition.useOn ?? "*";
		this.handler = definition.handler;
		this.register();
	}

	register(): void {
		getNearestApp().addMiddleware(this);
	}

	useOn: MiddlewareUseOn = "*";
	handler!: MiddlewareHandler;

	get routeIds(): Array<string> {
		if (this.useOn === "*") return ["*"];
		const targets = Array.isArray(this.useOn) ? this.useOn : [this.useOn];
		const routeIds = new Set<string>();
		for (const target of targets) {
			if (isString(target)) {
				routeIds.add(target);
			} else if ("id" in target) {
				routeIds.add(target.id);
			} else {
				target.routeIds.forEach((id) => routeIds.add(id));
			}
		}
		return Array.from(routeIds);
	}
}

export type { MiddlewareUseOn, MiddlewareHandler, MiddlewareDefinition };
export { Middleware };

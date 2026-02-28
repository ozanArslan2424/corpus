import { ControllerAbstract } from "@/Controller/ControllerAbstract";
import type { Middleware } from "@/Middleware/Middleware";
import { Route } from "@/Route/Route";
import type { MiddlewareHandler } from "@/Middleware/types/MiddlewareHandler";
import type { RouteId } from "@/Route/types/RouteId";

export class MiddlewareRegistry {
	private readonly map = new Map<string, MiddlewareHandler>();

	add(item: Middleware): void {
		const useOn = item.useOn;

		if (useOn === "*") {
			const arr: MiddlewareHandler[] = [];
			const globals = this.map.get("*");
			if (globals) {
				arr.push(globals);
			}
			arr.push(item.handler);
			this.map.set("*", this.compile(arr));
			return;
		}

		const targets = Array.isArray(useOn) ? useOn : [useOn];

		for (const target of targets) {
			const routeIds =
				target instanceof Route
					? [target.id]
					: target instanceof ControllerAbstract
						? Array.from(target.routeIds)
						: [];

			for (const routeId of routeIds) {
				const arr: MiddlewareHandler[] = [];
				const locals = this.map.get(routeId);
				if (locals) {
					arr.push(locals);
				}
				arr.push(item.handler);
				this.map.set(routeId, this.compile(arr));
			}
		}
	}

	find(routeId: RouteId): MiddlewareHandler {
		const arr: MiddlewareHandler[] = [];
		const globals = this.map.get("*");
		if (globals) {
			arr.push(globals);
		}

		const locals = this.map.get(routeId);
		if (locals) {
			arr.push(locals);
		}

		return this.compile(arr);
	}

	private compile(handlers: MiddlewareHandler[]): MiddlewareHandler {
		return async (ctx) => {
			for (const h of handlers) {
				await h(ctx);
			}
		};
	}
}

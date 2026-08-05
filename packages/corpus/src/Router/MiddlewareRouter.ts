import type { Middleware } from "@/Middleware/Middleware";
import type { MiddlewareHandler, MiddlewareUseOn } from "@/Middleware/types";
import type { MiddlewareRouterInterface } from "@/Registry/types";

export class MiddlewareRouter implements MiddlewareRouterInterface {
	private readonly global: MiddlewareHandler[] = [];
	private readonly local = new Map<string, MiddlewareHandler[]>();

	add(middleware: Middleware): void {
		for (const routeId of this.resolveRouteIds(middleware.useOn)) {
			if (routeId === "*") {
				this.global.push(middleware.handler);
			} else {
				const arr = this.local.get(routeId);
				if (arr) arr.push(middleware.handler);
				else this.local.set(routeId, [middleware.handler]);
			}
		}
	}

	/**
	 * Returns the ordered middleware handlers for a route: global middlewares
	 * first (outermost), then route-specific ones. Does not include the terminal.
	 */
	find(routeId: string): MiddlewareHandler[] {
		const local = this.local.get(routeId) ?? [];
		return [...this.global, ...local];
	}

	private resolveRouteIds(useOn: MiddlewareUseOn): string[] {
		if (useOn === "*") return ["*"];
		const targets = Array.isArray(useOn) ? useOn : [useOn];
		const routeIds = new Set<string>();
		for (const target of targets) {
			if (typeof target === "string") {
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

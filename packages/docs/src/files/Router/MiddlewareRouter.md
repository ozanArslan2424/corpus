# Middleware Router

```ts
import type { Middleware } from "@/Middleware/Middleware";
import {
	MiddlewareVariant,
	type MiddlewareHandler,
	type MiddlewareUseOn,
} from "@/Middleware/types";
import type { MiddlewareRouterInterface } from "@/Registry/types";
import type { MiddlewareRouterReturn } from "@/Router/types";
import { compile } from "@ozanarslan/utils/compile";

export class MiddlewareRouter implements MiddlewareRouterInterface {
	private readonly maps = {
		[MiddlewareVariant.inbound]: new Map<string, MiddlewareHandler[]>(),
		[MiddlewareVariant.outbound]: new Map<string, MiddlewareHandler[]>(),
	};

	add(middleware: Middleware): void {
		const map = this.maps[middleware.variant];
		for (const routeId of this.resolveRouteIds(middleware.useOn)) {
			let handlers = map.get(routeId);
			if (!handlers) {
				handlers = [];
				map.set(routeId, handlers);
			}
			handlers.push(middleware.handler);
		}
	}

	find(routeId: string): MiddlewareRouterReturn {
		return {
			inbound: compile(this.maps[MiddlewareVariant.inbound].get(routeId) ?? []),
			outbound: compile(this.maps[MiddlewareVariant.outbound].get(routeId) ?? []),
		};
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
```

import { RouterAbstract } from "@/internal/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import type { AnyRoute } from "@/internal/types/AnyRoute";

export class RouterUsingMap extends RouterAbstract implements RouterInterface {
	private map = new Map<
		string, // Grouped by id
		AnyRoute
	>();

	addRoute(route: AnyRoute): void {
		this.map.set(route.id, route);
	}

	getRoutes(): Array<AnyRoute> {
		return Array.from(this.map.values());
	}

	updateRoute(route: AnyRoute): void {
		this.map.set(route.id, route);
	}
}

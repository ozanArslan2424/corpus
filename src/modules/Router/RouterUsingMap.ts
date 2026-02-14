import { RouterAbstract } from "@/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/modules/Router/RouterInterface";
import type { AnyRoute } from "@/modules/Route/types/AnyRoute";
import type { RouteId } from "@/modules/Route/types/RouteId";

export class RouterUsingMap extends RouterAbstract implements RouterInterface {
	private map = new Map<RouteId, AnyRoute>();

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

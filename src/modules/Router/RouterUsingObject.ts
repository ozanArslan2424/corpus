import { RouterAbstract } from "@/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/modules/Router/RouterInterface";
import type { AnyRoute } from "@/modules/Route/types/AnyRoute";
import type { RouteId } from "@/modules/Route/types/RouteId";

export class RouterUsingObject
	extends RouterAbstract
	implements RouterInterface
{
	private object: Record<RouteId, AnyRoute> = {};

	addRoute(route: AnyRoute): void {
		this.object[route.id] = route;
	}

	getRoutes(): Array<AnyRoute> {
		return Object.values(this.object).flat();
	}

	updateRoute(route: AnyRoute): void {
		this.object[route.id] = route;
	}
}

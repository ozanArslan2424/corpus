import { RouterAbstract } from "@/internal/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import type { AnyRoute } from "@/internal/types/AnyRoute";

export class RouterUsingObject
	extends RouterAbstract
	implements RouterInterface
{
	private object: Record<
		string, // Grouped by id
		AnyRoute
	> = {};

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

import { RouterAbstract } from "@/internal/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import type { AnyRoute } from "@/internal/types/AnyRoute";

export class RouterUsingArray
	extends RouterAbstract
	implements RouterInterface
{
	private array: Array<AnyRoute> = [];

	addRoute(route: AnyRoute): void {
		this.array.push(route);
	}

	getRoutes(): Array<AnyRoute> {
		return this.array;
	}

	updateRoute(route: AnyRoute): void {
		this.array.map((r) => (r.id === route.id ? route : r));
	}
}

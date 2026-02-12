import { RouterVariant } from "@/internal/enums/RouterVariant";
import { Config } from "@/internal/modules/Config/Config";
import { RouterAbstract } from "@/internal/modules/Router/RouterAbstract";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import { RouterUsingArray } from "@/internal/modules/Router/RouterUsingArray";
import { RouterUsingMap } from "@/internal/modules/Router/RouterUsingMap";
import { RouterUsingObject } from "@/internal/modules/Router/RouterUsingObject";
import type { AnyRoute } from "@/internal/types/AnyRoute";

export class Router extends RouterAbstract implements RouterInterface {
	private instance: RouterInterface;

	private getInstance(): RouterInterface {
		const variant = Config.get<RouterVariant>("ROUTER_VARIANT_ENV_KEY", {
			fallback: RouterVariant.array,
		});

		switch (variant) {
			case RouterVariant.map:
				return new RouterUsingMap();

			case RouterVariant.object:
				return new RouterUsingObject();

			case RouterVariant.array:
			default:
				return new RouterUsingArray();
		}
	}

	constructor() {
		super();
		this.instance = this.getInstance();
	}

	addRoute(route: AnyRoute): void {
		this.checkPossibleCollision(route.path, route.method);
		this.addPossibleCollision(route.path);
		return this.instance.addRoute(route);
	}

	getRoutes(): Array<AnyRoute> {
		return this.instance.getRoutes();
	}

	updateRoute(route: AnyRoute): void {
		return this.instance.updateRoute(route);
	}
}

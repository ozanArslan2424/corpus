import type { BaseRoute } from "@/C/BaseRouteAbstract";
import type { Middleware } from "@/C/Middleware";

export type RouterReturn = {
	route: BaseRoute;
	middlewares: Array<Middleware>;
	params: Record<string, string>;
};

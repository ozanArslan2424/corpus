import type { Middleware } from "@/Middleware/Middleware";
import type { BaseRoute } from "@/Route/BaseRoute";

export type RouterReturn = {
	route: BaseRoute;
	middlewares: Array<Middleware>;
	params: Record<string, string>;
};

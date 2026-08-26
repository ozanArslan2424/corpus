import type { Middleware } from "@/C/Middleware/Middleware";
import type { RouteBase } from "@/C/RouteBase/RouteBase";

export type RouterReturn = {
	route: RouteBase;
	middlewares: Array<Middleware>;
	params: Record<string, string>;
};

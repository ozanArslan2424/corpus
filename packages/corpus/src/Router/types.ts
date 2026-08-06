import type { BaseRoute } from "@/Route/BaseRoute";

export type RouterReturn = {
	route: BaseRoute;
	params: Record<string, string>;
};

import type { BaseRoute } from "@/Route/BaseRoute";
import type { RouteConfig } from "@/Route/types";
import type { SchemaValidator } from "@/utils/Schema";

export type RouterData = Omit<BaseRoute<any, any, any, any>, "model" | "register"> & {
	config?: RouteConfig;
	validators?: {
		body?: SchemaValidator<any>;
		search?: SchemaValidator<any>;
		params?: SchemaValidator<any>;
	};
};

export type RouterReturn = {
	route: RouterData;
	params: Record<string, string>;
};

import type { MiddlewareHandler } from "@/Middleware/types";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { SchemaValidator } from "@/utils/Schema";

export type RouterData = Pick<
	BaseRoute<any, any, any, any>,
	"variant" | "id" | "method" | "endpoint" | "handler"
> & {
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

export type MiddlewareRouterReturn = {
	inbound: MiddlewareHandler;
	outbound: MiddlewareHandler;
};

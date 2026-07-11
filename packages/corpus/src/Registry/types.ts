import type { Middleware } from "@/Middleware/Middleware";
import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { RouteModel } from "@/Route/types";
import type { RouterReturn, RouterData, MiddlewareRouterReturn } from "@/Router/types";
import type { RequestHandler } from "@/Server/types";
import type { Func } from "@/utils/functions";
import type { SchemaValidator } from "@/utils/Schema";

export interface RegistryInterface {
	adapter: RouterAdapterInterface;
	router: RouterInterface;
	docs: Map<string, RegistryDocEntry>;
	cors: CorsInterface | null;
	prefix: string;
	middlewares: MiddlewareRouterInterface;
	urlParamsParser: ObjectParserInterface<Record<string, string>>;
	searchParamsParser: ObjectParserInterface<URLSearchParams>;
	formDataParser: ObjectParserInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
	reset(): void;
}

export type RegistryDocEntry = {
	id: string;
	endpoint: string;
	method: string;
	model: RouteModel<any, any, any, any> | undefined;
};

export interface RouterAdapterInterface {
	readonly __brand: string;
	find(req: Req): RouterReturn | null;
	add(data: RouterData): void;
	list: Func<[], Array<RouterData>> | undefined;
}

export interface RouterInterface {
	add(route: BaseRoute<any, any, any, any>): void;
	find(req: Req): RouterReturn | null;
	list(): Array<RouterData>;
}

export interface CorsInterface extends Middleware {
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: RequestHandler;
}

export interface MiddlewareRouterInterface {
	add(middleware: Middleware): void;
	find(routeId: string): MiddlewareRouterReturn;
}

export interface ObjectParserInterface<T> {
	parse(input: T): Record<string, unknown>;
}

export interface BodyParserInterface {
	parse(
		r: Req | Res | Response,
		maxRequestBodySize?: number,
	): Promise<Record<string, unknown> | Array<unknown> | string | ReadableStream<Uint8Array>>;
}

export interface SchemaParserInterface {
	parse<T = Record<string, unknown>>(
		label: string,
		data: unknown,
		validate?: SchemaValidator<T>,
	): Promise<T>;
	parseSync<T = Record<string, unknown>>(
		label: string,
		data: unknown,
		validate?: SchemaValidator<T>,
	): T;
}

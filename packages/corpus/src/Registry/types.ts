import type { Method } from "@/enums/Method";
import type { Middleware } from "@/Middleware/Middleware";
import type { MiddlewareHandler } from "@/Middleware/types";
import type { Res } from "@/Res/Res";
import type { ContextHandler, RouteModel } from "@/Route/types";
import type { RouterReturn, RouterData } from "@/Router/types";
import type { SchemaValidator } from "@/utils/Schema";

export interface RegistryInterface {
	router: RouterInterface;
	docs: Map<string, RegistryDocEntry>;
	cors: CorsInterface | null;
	prefix: string;
	middlewareRouter: MiddlewareRouterInterface;
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

export interface RouterInterface {
	readonly __brand: string;
	find(method: Method, url: string | URL): RouterReturn | null;
	add(data: RouterData): void;
	list(): Array<RouterData>;
}

export interface CorsInterface extends Middleware {
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
}

export interface MiddlewareRouterInterface {
	add(middleware: Middleware): void;
	find(routeId: string): MiddlewareHandler[];
}

export interface ObjectParserInterface<T> {
	parse(input: T): Record<string, unknown>;
}

export interface BodyParserInterface {
	parse(
		r: Request | Res | Response,
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

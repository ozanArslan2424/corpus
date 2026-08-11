import type { Method } from "@/enums/Method";
import type { Middleware } from "@/Middleware/Middleware";
import type { MiddlewareHandler } from "@/Middleware/types";
import type { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { ContextHandler } from "@/Route/types";
import type { RouterReturn } from "@/Router/types";
import type { Schema } from "@/utils/Schema";

export interface RegistryInterface {
	router: RouterInterface;
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

export interface RouterInterface {
	readonly __brand: string;
	find(method: Method, url: string | URL): RouterReturn | null;
	add(data: BaseRoute): void;
	list(): Array<BaseRoute>;
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
	parse<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): Promise<T>;
	parseSync<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): T;
}

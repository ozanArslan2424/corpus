import type { Schema } from "@ozanarslan/utils";

import type { BaseRoute } from "@/C/BaseRouteAbstract";
import type { CorsOptions } from "@/C/Cors/types";
import type { Method } from "@/C/Method";
import type { Middleware } from "@/C/Middleware";
import type { Res } from "@/C/Res";
import type { ContextHandler } from "@/C/Route/types";
import type { RouterReturn } from "@/C/Router/types";

export interface RegistryInterface {
	baseUrl: string;
	prefix: string;
	router: RouterInterface;
	cors: CorsInterface | null;
	urlParamsParser: ObjectParserInterface<Record<string, string>>;
	searchParamsParser: ObjectParserInterface<URLSearchParams>;
	formDataParser: ObjectParserInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
	reset(): void;
}

export interface RouterInterface {
	find(method: Method, url: string | URL): RouterReturn | null;
	add(data: BaseRoute): void;
	list(): Array<BaseRoute>;
	addMiddleware(middleware: Middleware): void;
	findMiddlewares(routeId: string): Array<Middleware>;
}

export interface CorsInterface extends Middleware {
	opts: CorsOptions | undefined;
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
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

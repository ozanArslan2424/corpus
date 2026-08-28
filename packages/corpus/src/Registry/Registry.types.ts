import type { CorsOptions } from "@/C/Cors/Cors.types";
import type { Middleware } from "@/C/Middleware/Middleware";
import type { Method } from "@/C/Req/Method";
import type { Res } from "@/C/Res/Res";
import type { ContextHandler } from "@/C/Route/Route.types";
import type { RouteBase } from "@/C/RouteBase/RouteBase";
import type { RouterReturn } from "@/C/Router/Router.types";
import type { Schema } from "@/utils";

export interface RegistryInterface {
	baseUrl: string;
	prefix: string;
	router: RouterInterface;
	cors: CorsInterface | null;
	urlParamsParser: ParserBaseInterface<Record<string, string>>;
	searchParamsParser: ParserBaseInterface<URLSearchParams>;
	formDataParser: ParserBaseInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
	reset(): void;
}

export interface RouterInterface {
	find(method: Method, url: string | URL): RouterReturn | null;
	add(data: RouteBase): void;
	list(): Array<RouteBase>;
	addMiddleware(middleware: Middleware): void;
	findMiddlewares(routeId: string): Array<Middleware>;
}

export interface CorsInterface extends Middleware {
	opts: CorsOptions | undefined;
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
}

export interface ParserBaseInterface<T> {
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

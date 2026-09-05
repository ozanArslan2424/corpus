import { registerApp } from "@/AppsRegistry";
import { Config } from "@/Config";
import { type ContextFactory, type ContextHandler, Context } from "@/Context";
import { getContextAccess } from "@/ContextAccess";
import type { CorsInterface } from "@/Cors";
import { Exception } from "@/Exception";
import { HeaderKey } from "@/Headers";
import type { MiddlewareHandler, Middleware } from "@/Middleware";
import { getOrInitParsersRegistry } from "@/ParsersRegistry";
import { Method } from "@/Request";
import { Res, Status } from "@/Res";
import { RouteVariant, type RouteBase } from "@/RouteBase";
import type { Server, ServerHandler, ServerRouteMap } from "@/Server";
import { arrIncludes } from "@/utils/array";
import { noop } from "@/utils/function";
import type { OrString } from "@/utils/lexical";
import { logger } from "@/utils/logger";
import {
	isEmpty,
	isNil,
	isNull,
	isUndefined,
	type Maybe,
	type MaybePromise,
	type Nullable,
	type Optional,
} from "@/utils/maybe";
import { withLeadingSlash } from "@/utils/path";
import type { WebSocketRoute } from "@/WebSocketRoute";

interface TlsOptions {
	cert: string | Buffer;
	key: string | Buffer;
	ca?: string | Buffer;
}

interface AppOptions {
	port?: number;
	prefix?: string;
	hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	idleTimeout?: number;
	tls?: TlsOptions;
	maxRequestBodySize?: number;
}

type ErrorHandler<R = unknown> = (error: Error, context?: Context) => MaybePromise<R>;

function composeHandlerChain(...handlers: Array<MiddlewareHandler>): MiddlewareHandler {
	return (c, outerNext) => {
		let index = -1;
		const dispatch = (i: number): ReturnType<MiddlewareHandler> => {
			if (i <= index) {
				throw new Exception("next() called multiple times", Status.INTERNAL_SERVER_ERROR);
			}
			index = i;

			const handler = handlers[i];
			if (!handler) return outerNext();

			let called = false;
			let downstream: unknown | undefined;
			const next = async () => {
				called = true;
				downstream = await dispatch(i + 1);
				return downstream;
			};

			return (async () => {
				const resBefore = c.res;
				const result = await handler(c, next);
				if (result !== undefined) return result; // terminal body OR middleware Res short-circuit
				if (!called) return await next();
				if (c.res !== resBefore) return c.res; // outbound mutation wins
				return downstream;
			})();
		};
		return dispatch(0);
	};
}

/**
 * Enforces the configured body size limit. Runs whether or not the body is
 * parsed - the limit is a property of the request, not of what the handler
 * happens to read.
 *
 * Content-Length is trusted: Bun's parser stops reading at the declared
 * length regardless of how much the client actually writes (verified - a
 * request declaring 10 and sending 10MB yields 10 bytes), so a declared
 * length under the limit needs no buffering. Chunked bodies carry no
 * declared length, so those are counted while streaming.
 *
 * Returns the request the body should be read from: the original when
 * nothing was consumed, and a re-wrapped one when a chunked body had to be
 * drained and `retain` asked for it back.
 */
async function enforceBodyLimit(
	request: Request,
	maxRequestBodySize: number,
	retain: boolean,
): Promise<Request | Response> {
	const header = request.headers.get(HeaderKey.ContentLength);
	const contentLength = header === null ? NaN : parseInt(header);

	if (!isNaN(contentLength)) {
		if (contentLength > maxRequestBodySize) {
			throw new Exception("Payload too large", Status.PAYLOAD_TOO_LARGE);
		}
		return request;
	}

	if (!request.body) return request;

	// Binary bodies are handed to the handler as a live stream, so draining
	// them here to count bytes would leave the handler with a consumed stream.
	// They are exempt from the chunked count; only the declared-length check
	// above applies to them.
	const contentType = request.headers.get(HeaderKey.ContentType) ?? "";
	if (/application\/octet-stream|application\/pdf|^image\/|^audio\/|^video\//.test(contentType)) {
		return request;
	}

	const reader = request.body.getReader();
	const chunks: Array<Uint8Array<ArrayBuffer>> = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxRequestBodySize) {
			await reader.cancel();
			throw new Exception("Payload too large", Status.PAYLOAD_TOO_LARGE);
		}
		// Chunks are only accumulated when the body will be parsed, so
		// enforcing a limit on a body nobody reads costs no memory.
		if (retain) chunks.push(value as Uint8Array<ArrayBuffer>);
	}

	if (!retain) return request;
	return new Response(new Blob(chunks), { headers: request.headers });
}

interface AppInterface {
	server: Nullable<Server>;
	cors: Optional<CorsInterface>;
	routes: Array<RouteBase>;
	middlewares: Map<string, Array<Middleware>>;
	port: number;
	prefix: string;
	hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	idleTimeout?: number;
	tls?: TlsOptions;
	get baseUrl(): string;
	listen(): Promise<void>;
	close(closeActiveConnections?: boolean): Promise<void>;
	handle(request: Request, server?: Maybe<Server>): Promise<Response>;
	handleBeforeListen: Optional<() => MaybePromise<void>>;
	handleBeforeClose: Optional<() => MaybePromise<void>>;
	handleError: ErrorHandler;
	handleNotFound: ContextHandler;
	handlePreflight: ContextHandler;
	contextFactory: ContextFactory;
	addMiddleware(middleware: Middleware): void;
	findMiddlewares(routeId: string): Array<Middleware>;
}

class App implements AppInterface {
	constructor(opts?: AppOptions) {
		if (opts?.port) this.port = opts.port;
		if (opts?.hostname) this.hostname = opts.hostname;
		if (opts?.idleTimeout) this.idleTimeout = opts.idleTimeout;
		if (opts?.tls) this.tls = opts.tls;
		if (opts?.prefix) this.prefix = opts.prefix;
		if (opts?.maxRequestBodySize) this.maxRequestBodySize = opts.maxRequestBodySize;
		registerApp(this);
	}

	server: Nullable<Server> = null;
	cors: Optional<CorsInterface>;
	routes: Array<RouteBase> = [];
	middlewares: Map<string, Array<Middleware>> = new Map();
	port: number = 3000;
	prefix: string = "";
	hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost"> = "0.0.0.0";
	idleTimeout?: number;
	tls?: TlsOptions;
	maxRequestBodySize?: number;

	get baseUrl(): string {
		if (!isNull(this.server)) return this.server.url.toString();
		const protocol = this.tls ? "https" : "http";
		return `${protocol}://${this.hostname}${this.port ? `:${this.port}` : ""}`;
	}

	protected createServer(): Server {
		if (!isNull(this.server)) return this.server;

		this.warnUnmatchedMiddlewares();

		this.server = Bun.serve({
			port: this.port,
			hostname: this.hostname,
			idleTimeout: this?.idleTimeout,
			tls: this?.tls,
			maxRequestBodySize: this.maxRequestBodySize,
			fetch: this.composeFetch(),
			routes: this.composeRoutes(),
			websocket: {
				open: (ws) => ws.data.onOpen?.(ws),
				message: (ws, msg) => ws.data.onMessage?.(ws, msg),
				close: (ws, code, reason) => ws.data.onClose?.(ws, code, reason),
			},
		});

		return this.server;
	}

	async listen(): Promise<void> {
		try {
			process.on("SIGINT", () => this.close());
			process.on("SIGTERM", () => this.close());

			await this.handleBeforeListen?.();

			this.createServer();
		} catch (err) {
			logger.error(err);
			await this.close();
		}
	}

	async close(closeActiveConnections: boolean = true): Promise<void> {
		await this.handleBeforeClose?.();
		await this.server?.stop(closeActiveConnections);
		this.server = null;
		if (Config.nodeEnv !== "test") process.exit(0);
	}

	async handle(request: Request, server?: Maybe<Server>): Promise<Response> {
		// TODO: This is how it should be but Bun.Server.fetch only handles the fetch argument
		// when it should also handle the routes argument. I'm not sure why this is the case
		// or if it is the case at all. it just doesn't work. Temporary regex matcher is used.
		//
		const app = this.createServer() ?? server;
		// // change the request base url to $registry.baseUrl first
		// const url = new URL(new URL(request.url).pathname, $registry.baseUrl);
		// request = new Request(url, request);
		app.stop();
		return await app.fetch(request);

		// const context = this.contextFactory(request, server);
		// return this.finalize(context, async (c) => {
		// 	try {
		// 		const isPreflight =
		// 			c.req.method === Method.OPTIONS &&
		// 			c.req.headers.has(HeaderKey.AccessControlRequestMethod);
		// 		if (isPreflight) {
		// 			return await this.handlePreflight(c);
		// 		}
		//
		// 		const match = this.find(c.req.method, c.req.url);
		// 		if (match) {
		// 			const composedHandler = composeHandlerChain(
		// 				...match.middlewares.map((m) => m.handler),
		// 				match.route.handler,
		// 			);
		// 			return await this.handleRoute(c, match.route, match.params, composedHandler);
		// 		}
		// 		const notFoundHandler = composeHandlerChain(
		// 			...this.findMiddlewares("*").map((m) => m.handler),
		// 			this.handleNotFound,
		// 		);
		// 		return await notFoundHandler(c, noop);
		// 	} catch (err) {
		// 		return await this.handleError(err as Error, c);
		// 	}
		// });
	}

	protected composeRoutes(): ServerRouteMap {
		const routes: ServerRouteMap = {};

		for (const route of this.routes) {
			const endpoint = withLeadingSlash(route.endpoint);
			const isWebSocket = route.variant === RouteVariant.websocket;
			const isWildcard = endpoint.endsWith("*");
			const isMethodWithoutBody = arrIncludes(route.method, [Method.GET, Method.HEAD]);
			const maxRequestBodySize = route.config?.maxRequestBodySize;

			const handlers = [...this.findMiddlewares(route.id).map((m) => m.handler), route.handler];

			const access = getContextAccess(handlers, route.config);
			const parsers = getOrInitParsersRegistry();

			const handler = composeHandlerChain(...handlers);

			routes[endpoint] ??= {};
			routes[endpoint]![route.method] = this.finalize(async (c) => {
				// Bun doesn't handle wildcards as params
				if (isWildcard) {
					const prefix = endpoint.slice(0, -1);
					const prefixIndex = c.req.url.indexOf(prefix);
					const wildcardValue = c.req.url.slice(prefixIndex + prefix.length).split("?")[0];
					if (wildcardValue) c.req.params["*"] = decodeURIComponent(wildcardValue);
				}

				if (access.params && !isEmpty(c.req.params)) {
					c.params = parsers.urlParamsParser.parse(c.req.params);
					c.params = await parsers.schemaParser.parse("params", c.params, route.config?.params);
				}

				const qIndex = access.search ? c.req.url.indexOf("?") : -1;
				if (qIndex !== -1) {
					const search = new URLSearchParams(c.req.url.slice(qIndex + 1));
					c.search = parsers.searchParamsParser.parse(search);
					c.search = await parsers.schemaParser.parse("search", c.search, route.config?.search);
				}

				// TODO: upgrade in WebSocketRoute
				if (isWebSocket) {
					const upgraded = c.server?.upgrade(c.req, {
						data: (await handler(c, noop)) as WebSocketRoute,
					});
					if (upgraded === false) throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
					return undefined;
				}

				if (!isMethodWithoutBody) {
					let input: Request | Response = c.req;

					if (!isUndefined(maxRequestBodySize)) {
						input = await enforceBodyLimit(c.req, maxRequestBodySize, access.body);
					}

					if (access.body) {
						c.body = await parsers.bodyParser.parse(input);
						c.body = await parsers.schemaParser.parse("body", c.body, route.config?.body);
					}
				}

				return await handler(c, noop);
			});
		}

		return routes;
	}

	protected composeFetch(): ServerHandler {
		const notFoundChain = composeHandlerChain(
			...this.findMiddlewares("*").map((m) => m.handler),
			this.handleNotFound,
		);

		return this.finalize((c) => {
			const isPreflight =
				c.req.method === Method.OPTIONS && c.req.headers.has(HeaderKey.AccessControlRequestMethod);
			if (isPreflight) {
				return this.handlePreflight(c);
			}
			return notFoundChain(c, noop);
		});
	}

	protected finalize(handler: ContextHandler): ServerHandler {
		return async (request, server) => {
			const context = this.contextFactory(request, server);

			try {
				return await this.respond(context, await handler(context));
			} catch (err) {
				return await this.respondWithError(context, err as Error);
			}
		};
	}

	/**
	 * Applies a handler's return value to the context's Res and serializes it.
	 * Everything here can throw as readily as the handler itself - CORS runs
	 * user-supplied logic, and toNativeResponse serializes a body of unknown
	 * shape - so it stays inside the caller's try rather than after it.
	 */
	protected async respond(context: Context, result: unknown): Promise<Response> {
		if (result instanceof Res) context.res = result;
		else if (result !== undefined) context.res.body = result;

		// CORS must come last and be separate from other middlewares
		await this.cors?.handler(context);

		return context.res.toNativeResponse();
	}

	/**
	 * Last line of defence. handleError is user-overridable and the Res it
	 * returns still has to survive serialization, so both are guarded. If that
	 * fails there is nothing left to attempt: a throw escaping here reaches Bun
	 * as a dropped connection, which the client sees as ECONNRESET rather than
	 * a response.
	 */
	protected async respondWithError(context: Context, err: Error): Promise<Response> {
		try {
			return await this.respond(context, await this.handleError(err, context));
		} catch (fatal) {
			logger.error(fatal);
			return new Response(null, { status: Status.INTERNAL_SERVER_ERROR });
		}
	}

	handleBeforeListen: Optional<() => MaybePromise<void>>;
	handleBeforeClose: Optional<() => MaybePromise<void>>;

	handleError: ErrorHandler = (err) => {
		if (err instanceof Exception) return err.toRes();
		return new Res({ message: "INTERNAL_SERVER_ERROR" }, { status: Status.INTERNAL_SERVER_ERROR });
	};

	handleNotFound: ContextHandler = (c) => {
		return new Res(
			{ message: `${c.req.method} on ${c.req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	handlePreflight: ContextHandler = (c) => {
		if (isNil(this.cors)) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		return this.cors.handlePreflight(c);
	};

	contextFactory: ContextFactory = (request, server) => {
		return new Context(request, server);
	};

	addMiddleware(middleware: Middleware): void {
		for (const routeId of middleware.routeIds) {
			const arr = this.middlewares.get(routeId);
			if (arr) arr.push(middleware);
			else this.middlewares.set(routeId, [middleware]);
		}
	}

	findMiddlewares(routeId: string): Array<Middleware> {
		const global = routeId === "*" ? [] : (this.middlewares.get("*") ?? []);
		const local = this.middlewares.get(routeId) ?? [];
		return [...global, ...local];
	}

	protected warnUnmatchedMiddlewares(): void {
		const routeIds = new Set(this.routes.map((route) => route.id));
		for (const routeId of this.middlewares.keys()) {
			if (routeId === "*" || routeIds.has(routeId)) continue;
			logger.warn(
				`Middleware targets route id "${routeId}", which is not registered on this app. It will never run.`,
			);
		}
	}
}

export type { AppInterface };
export { App };

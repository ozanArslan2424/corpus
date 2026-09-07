/**
 * The application root: owns the {@link Server}, the route table, the
 * {@link Middleware} registry, and the request lifecycle that ties them
 * together.
 *
 * An {@link App} is the only thing that talks to Bun's HTTP server.
 * {@link RouteBase} implementations and {@link Middleware} instances register
 * themselves against an app, and at {@link App.listen} time the app compiles
 * them into a single {@link ServerRouteMap} plus a fallback {@link ServerHandler}.
 *
 * ```ts
 * const app = new App({ port: 3000, prefix: "/api" });
 * await app.listen();
 * ```
 *
 * @module App
 */

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
	type MaybePromise,
	type Nullable,
	type Optional,
} from "@/utils/maybe";
import { withLeadingSlash } from "@/utils/path";
import type { WebSocketRoute } from "@/WebSocketRoute";

/**
 * TLS material used to serve an {@link App} over HTTPS.
 *
 * Passing this to {@link App} switches {@link App.baseUrl} to the `https`
 * scheme and hands the certificate straight to Bun's server.
 */
interface TlsOptions {
	/** PEM-encoded certificate chain, as a string or a file buffer. */
	cert: string | Buffer;
	/** PEM-encoded private key matching {@link TlsOptions.cert}. */
	key: string | Buffer;
	/** Optional PEM-encoded certificate authority bundle for client verification. */
	ca?: string | Buffer;
}

/**
 * Construction options for {@link App}. Every field is optional; omitted fields
 * keep the defaults declared on {@link App}.
 */
interface AppOptions {
	/** TCP port to bind. See {@link App.port}. */
	port?: number;
	/**
	 * Path prefix prepended to the endpoint of every {@link RouteBase} registered
	 * on the app. See {@link App.prefix}.
	 */
	prefix?: string;
	/** Interface to bind. See {@link App.hostname}. */
	hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	/** Seconds a connection may stay idle before Bun closes it. See {@link App.idleTimeout}. */
	idleTimeout?: number;
	/** {@link TlsOptions} to serve the app over HTTPS. See {@link App.tls}. */
	tls?: TlsOptions;
	/**
	 * App-wide request body ceiling in bytes, handed to Bun's server. An
	 * individual {@link RouteBase} can tighten this through its own
	 * {@link Config}, which {@link enforceBodyLimit} applies per request.
	 */
	maxRequestBodySize?: number;
}

/**
 * Handles an {@link Error} raised anywhere in the request lifecycle. Assigned to
 * {@link App.handleError}.
 *
 * @param error - The thrown error, typically an {@link Exception}.
 * @param context - The {@link Context} the error was raised in. Absent only when
 * the failure happened before a {@link Context} could be built.
 * @returns The value to respond with — a {@link Res}, a plain body that
 * {@link App.respond} will assign to {@link Res.body}, or a promise of either.
 */
type ErrorHandler<R = unknown> = (error: Error, context?: Context) => MaybePromise<R>;

/**
 * Folds {@link Middleware} handlers and a terminal {@link RouteBase} handler
 * into one {@link MiddlewareHandler}, giving each link an `await next()` that
 * runs the rest of the chain.
 *
 * Resolution order for what a link contributes to the response:
 *
 * 1. A returned value wins — it is either the terminal body or a
 *    {@link Middleware} short-circuiting the chain with a {@link Res}.
 * 2. If `next()` was never called, it is called implicitly so the chain still
 *    reaches its terminal handler.
 * 3. If the handler replaced {@link Context.res} after `next()` resolved, that
 *    outbound mutation wins over the downstream result.
 * 4. Otherwise the downstream result passes through untouched.
 *
 * @param handlers - {@link MiddlewareHandler} functions in execution order; the
 * last one is normally the {@link RouteBase} handler.
 * @returns A single {@link MiddlewareHandler} that runs the whole chain,
 * delegating to its own `next` once the chain is exhausted.
 * @throws {@link Exception} with {@link Status.INTERNAL_SERVER_ERROR} if a
 * handler calls `next()` more than once.
 */
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
 * Enforces the body size limit declared by a {@link RouteBase}'s {@link Config}.
 * Runs whether or not the body is parsed — the limit is a property of the
 * request, not of what the handler happens to read.
 *
 * {@link HeaderKey.ContentLength} is trusted: Bun's parser stops reading at the
 * declared length regardless of how much the client actually writes (verified —
 * a request declaring 10 and sending 10MB yields 10 bytes), so a declared length
 * under the limit needs no buffering. Chunked bodies carry no declared length,
 * so those are counted while streaming.
 *
 * Binary content types are exempt from the streaming count: they are handed to
 * the handler as a live stream, and draining them here would leave the handler
 * with a consumed body. Only the declared-length check applies to them.
 *
 * @param request - The incoming request to measure.
 * @param maxRequestBodySize - Ceiling in bytes for the request body.
 * @param retain - Whether the drained chunks are kept so the body can be read
 * again by the parsers. Pass `true` only when the body will actually be parsed;
 * `false` counts bytes without holding them in memory.
 * @returns The request the body should be read from — the original when nothing
 * was consumed, or a re-wrapped one carrying the buffered chunks when a chunked
 * body had to be drained and `retain` asked for it back.
 * @throws {@link Exception} with {@link Status.PAYLOAD_TOO_LARGE} when the
 * declared or observed size exceeds `maxRequestBodySize`.
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

/**
 * The public shape of an application instance, implemented by {@link App}.
 *
 * Depend on this type rather than the {@link App} class when you need to accept
 * an app without pinning the implementation.
 */
interface AppInterface {
	/** The running {@link Server}, or `null` before {@link AppInterface.listen} and after {@link AppInterface.close}. */
	server: Nullable<Server>;
	/** {@link CorsInterface} policy applied to every response and to preflight requests. */
	cors: Optional<CorsInterface>;
	/** {@link RouteBase} instances registered on this app, in registration order. */
	routes: Array<RouteBase>;
	/** {@link Middleware} instances keyed by the {@link RouteBase.id} they target; `"*"` holds the global ones. */
	middlewares: Map<string, Array<Middleware>>;
	/** TCP port to bind. */
	port: number;
	/** Path prefix prepended to every {@link RouteBase} endpoint on this app. */
	prefix: string;
	/** Interface to bind. */
	hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	/** Seconds a connection may stay idle before Bun closes it. */
	idleTimeout?: number;
	/** {@link TlsOptions} material; when set, the app is served over HTTPS. */
	tls?: TlsOptions;
	/** Origin the app is reachable at. */
	get baseUrl(): string;
	/** Compiles {@link RouteBase} and {@link Middleware} registrations and starts the {@link Server}. */
	listen(): Promise<void>;
	/** Stops the {@link Server} and releases the port. */
	close(closeActiveConnections?: boolean): Promise<void>;
	/** Hook run just before the {@link Server} starts. */
	handleBeforeListen: Optional<() => MaybePromise<void>>;
	/** Hook run just before the {@link Server} stops. */
	handleBeforeClose: Optional<() => MaybePromise<void>>;
	/** {@link ErrorHandler} that converts a thrown {@link Error} into a response value. */
	handleError: ErrorHandler;
	/** {@link ContextHandler} that produces the response for requests matching no {@link RouteBase}. */
	handleNotFound: ContextHandler;
	/** {@link ContextHandler} that produces the response for CORS preflight requests. */
	handlePreflight: ContextHandler;
	/** {@link ContextFactory} that builds the {@link Context} for each incoming request. */
	contextFactory: ContextFactory;
	/** Registers a {@link Middleware} against each {@link RouteBase.id} it targets. */
	addMiddleware(middleware: Middleware): void;
	/** Resolves the {@link Middleware} instances that apply to a {@link RouteBase.id}. */
	findMiddlewares(routeId: string): Array<Middleware>;
}

/**
 * An HTTP application.
 *
 * The app is a container first: {@link RouteBase} implementations and
 * {@link Middleware} instances attach to it as they are constructed. Nothing is
 * compiled until {@link App.listen}, at which point {@link App.composeRoutes}
 * turns routes into a {@link ServerRouteMap} and folds the matching
 * {@link Middleware} handlers into each route's chain.
 *
 * Every request follows the same path — build a {@link Context}, resolve
 * {@link Context.params}, {@link Context.search} and {@link Context.body}
 * through the parsers registry, run the {@link composeHandlerChain} chain, apply
 * {@link CorsInterface}, and serialise the {@link Res}. Anything thrown along
 * the way is routed to {@link App.handleError}.
 *
 * Constructing an app calls {@link registerApp}, so it is discoverable without
 * being passed around.
 */
class App implements AppInterface {
	/**
	 * Creates an app and registers it globally with {@link registerApp}.
	 *
	 * @param opts - {@link AppOptions} overriding port, hostname, prefix, idle
	 * timeout, {@link TlsOptions} and body size. Any field left out keeps the
	 * default declared on the corresponding {@link App} property.
	 */
	constructor(opts?: AppOptions) {
		if (opts?.port) this.port = opts.port;
		if (opts?.hostname) this.hostname = opts.hostname;
		if (opts?.idleTimeout) this.idleTimeout = opts.idleTimeout;
		if (opts?.tls) this.tls = opts.tls;
		if (opts?.prefix) this.prefix = opts.prefix;
		if (opts?.maxRequestBodySize) this.maxRequestBodySize = opts.maxRequestBodySize;
		registerApp(this);
	}

	/**
	 * The live {@link Server}. `null` until {@link App.listen} is called and again
	 * after {@link App.close}.
	 */
	server: Nullable<Server> = null;

	/**
	 * {@link CorsInterface} policy for this app. When set,
	 * {@link CorsInterface.handler} runs after every handler chain in
	 * {@link App.respond} and {@link CorsInterface.handlePreflight} answers
	 * preflight requests. Left unset, {@link App.handlePreflight} replies with
	 * {@link Status.NO_CONTENT} and no CORS headers are added.
	 */
	cors: Optional<CorsInterface>;

	/** {@link RouteBase} instances attached to this app, in registration order. */
	routes: Array<RouteBase> = [];

	/**
	 * {@link Middleware} instances indexed by the {@link RouteBase.id} they
	 * target. The `"*"` key holds middlewares that run on every route as well as
	 * on the {@link App.handleNotFound} path.
	 */
	middlewares: Map<string, Array<Middleware>> = new Map();

	/** Port the {@link Server} binds to. Defaults to `3000`. */
	port: number = 3000;

	/** Prefix prepended to every {@link RouteBase} endpoint on this app. Defaults to `""`. */
	prefix: string = "";

	/** Interface the {@link Server} binds to. Defaults to `"0.0.0.0"`. */
	hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost"> = "0.0.0.0";

	/** Seconds an idle connection is kept open before Bun closes it. */
	idleTimeout?: number;

	/** {@link TlsOptions} material. When present the app is served over HTTPS. */
	tls?: TlsOptions;

	/**
	 * App-wide body ceiling in bytes passed to Bun. A {@link RouteBase} may
	 * declare a tighter limit in its {@link Config}, enforced per request by
	 * {@link enforceBodyLimit}.
	 */
	maxRequestBodySize?: number;

	/**
	 * Origin the app is reachable at, for example `http://0.0.0.0:3000`.
	 *
	 * @returns The {@link Server} URL once listening; otherwise a URL derived from
	 * {@link App.tls}, {@link App.hostname} and {@link App.port}.
	 */
	get baseUrl(): string {
		if (!isNull(this.server)) return this.server.url.toString();
		const protocol = this.tls ? "https" : "http";
		return `${protocol}://${this.hostname}${this.port ? `:${this.port}` : ""}`;
	}

	/**
	 * Compiles {@link App.composeRoutes} and {@link App.composeFetch} and hands
	 * them to `Bun.serve`, wiring the WebSocket callbacks through to the handlers
	 * carried by each {@link WebSocketRoute}. Unroutable middlewares are reported
	 * first by {@link App.warnUnmatchedMiddlewares}.
	 *
	 * Calling this when {@link App.server} already exists is a no-op that returns
	 * the existing one, so it is safe to reach for lazily.
	 *
	 * @returns The running {@link Server}.
	 */
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

	/**
	 * Starts the app.
	 *
	 * Installs `SIGINT` and `SIGTERM` handlers that call {@link App.close}, runs
	 * {@link App.handleBeforeListen}, then compiles and starts the {@link Server}
	 * via {@link App.createServer}. A failure at any of these steps is logged and
	 * the app is closed rather than left half-started.
	 *
	 * @returns A promise that resolves once the {@link Server} is listening.
	 */
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

	/**
	 * Stops the app.
	 *
	 * Runs {@link App.handleBeforeClose}, stops the {@link Server}, and clears
	 * {@link App.server}. Outside the `test` value of {@link Config.nodeEnv} this
	 * also exits the process, so tests can close apps without tearing down the
	 * runner.
	 *
	 * @param closeActiveConnections - Whether in-flight connections are severed
	 * immediately rather than allowed to drain. Defaults to `true`.
	 * @returns A promise that resolves once the {@link Server} has stopped.
	 */
	async close(closeActiveConnections: boolean = true): Promise<void> {
		await this.handleBeforeClose?.();
		await this.server?.stop(closeActiveConnections);
		this.server = null;
		if (Config.nodeEnv !== "test") process.exit(0);
	}

	// TODO: async handle(request: Request, server?: Maybe<Server>): Promise<Response>

	/**
	 * Compiles {@link App.routes} into the {@link ServerRouteMap} Bun expects,
	 * keyed by endpoint and then by {@link Method}.
	 *
	 * Each entry is a full request pipeline wrapped in {@link App.finalize}:
	 * wildcard segments are lifted into {@link Req.params} (Bun does not treat
	 * them as params), then params, search and body are parsed and validated
	 * against the {@link RouteBase} {@link Config} — but only the ones the handler
	 * chain actually reads, as reported by {@link getContextAccess}. Routes with
	 * {@link RouteVariant.websocket} upgrade the connection into a
	 * {@link WebSocketRoute} instead of responding, and {@link Method.GET} and
	 * {@link Method.HEAD} skip body work entirely.
	 *
	 * @returns A {@link ServerRouteMap} ready to hand to `Bun.serve`.
	 * @throws {@link Exception} with {@link Status.UPGRADE_REQUIRED} when a
	 * WebSocket upgrade is rejected.
	 */
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

	/**
	 * Builds the {@link ServerHandler} Bun uses for requests that matched no
	 * {@link RouteBase}.
	 *
	 * Preflight requests — {@link Method.OPTIONS} carrying
	 * {@link HeaderKey.AccessControlRequestMethod} — go to
	 * {@link App.handlePreflight}. Everything else runs the global (`"*"`)
	 * {@link Middleware} chain followed by {@link App.handleNotFound}, so global
	 * middlewares still observe traffic to unknown endpoints.
	 *
	 * @returns The `fetch` handler for `Bun.serve`, wrapped by
	 * {@link App.finalize}.
	 */
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

	/**
	 * Wraps a {@link ContextHandler} into the {@link ServerHandler} Bun calls,
	 * giving it a {@link Context} from {@link App.contextFactory} and guaranteeing
	 * that every outcome — value or throw — leaves as a `Response`.
	 *
	 * This is the single boundary where errors are caught, so every throw reaches
	 * {@link App.handleError} through {@link App.respondWithError}.
	 *
	 * @param handler - The {@link ContextHandler} to run for the request.
	 * @returns A {@link ServerHandler} suitable for a {@link ServerRouteMap} entry
	 * or for `Bun.serve`'s `fetch`.
	 */
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
	 * Turns a handler's return value into the response sent over the wire.
	 *
	 * A returned {@link Res} replaces {@link Context.res} wholesale; any other
	 * defined value becomes {@link Res.body}; `undefined` leaves the existing
	 * {@link Res} untouched, which is how handlers that mutate
	 * {@link Context.res} directly are supported. {@link CorsInterface.handler}
	 * runs last and separately from the {@link Middleware} chain, so CORS headers
	 * cannot be clobbered by a short-circuiting middleware.
	 *
	 * @param context - The {@link Context} for the request.
	 * @param result - Whatever the handler chain returned.
	 * @returns The native `Response` produced by {@link Res.toNativeResponse}.
	 */
	protected async respond(context: Context, result: unknown): Promise<Response> {
		if (result instanceof Res) context.res = result;
		else if (result !== undefined) context.res.body = result;

		// CORS must come last and be separate from other middlewares
		await this.cors?.handler(context);

		return context.res.toNativeResponse();
	}

	/**
	 * Runs {@link App.handleError} and responds with its result.
	 *
	 * If the error handler itself throws, that second failure is logged and a bare
	 * {@link Status.INTERNAL_SERVER_ERROR} is returned — the request never escapes
	 * without a response.
	 *
	 * @param context - The {@link Context} the failure occurred in.
	 * @param err - The {@link Error} thrown by the handler chain.
	 * @returns The error response.
	 */
	protected async respondWithError(context: Context, err: Error): Promise<Response> {
		try {
			return await this.respond(context, await this.handleError(err, context));
		} catch (fatal) {
			logger.error(fatal);
			return new Response(null, { status: Status.INTERNAL_SERVER_ERROR });
		}
	}

	/**
	 * Hook run inside {@link App.listen}, before the {@link Server} is created.
	 * Use it for setup that must complete before traffic is accepted; throwing
	 * here aborts startup and closes the app.
	 */
	handleBeforeListen: Optional<() => MaybePromise<void>>;

	/**
	 * Hook run inside {@link App.close}, before the {@link Server} is stopped. Use
	 * it to release resources the app owns.
	 */
	handleBeforeClose: Optional<() => MaybePromise<void>>;

	/**
	 * Default {@link ErrorHandler}. An {@link Exception} is rendered through
	 * {@link Exception.toRes}; anything else becomes an opaque
	 * {@link Status.INTERNAL_SERVER_ERROR} {@link Res}, so internal failures never
	 * leak their message. Replace it to customise error output.
	 *
	 * @param err - The thrown {@link Error}.
	 * @returns The {@link Res} to send.
	 */
	handleError: ErrorHandler = (err) => {
		if (err instanceof Exception) return err.toRes();
		return new Res({ message: "INTERNAL_SERVER_ERROR" }, { status: Status.INTERNAL_SERVER_ERROR });
	};

	/**
	 * Default {@link ContextHandler} for unmatched requests. Replace it to
	 * customise the 404 body.
	 *
	 * @param c - The {@link Context} for the unmatched request.
	 * @returns A {@link Status.NOT_FOUND} {@link Res} naming the method and URL
	 * that did not resolve.
	 */
	handleNotFound: ContextHandler = (c) => {
		return new Res(
			{ message: `${c.req.method} on ${c.req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	/**
	 * Default {@link ContextHandler} for CORS preflight requests. Delegates to
	 * {@link CorsInterface.handlePreflight} when {@link App.cors} is configured.
	 *
	 * @param c - The {@link Context} for the preflight request.
	 * @returns The CORS preflight response, or an empty
	 * {@link Status.NO_CONTENT} {@link Res} when no {@link CorsInterface} is set.
	 */
	handlePreflight: ContextHandler = (c) => {
		if (isNil(this.cors)) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		return this.cors.handlePreflight(c);
	};

	/**
	 * Default {@link ContextFactory}. Replace it to have the app build a
	 * {@link Context} subclass carrying your own per-request state.
	 *
	 * @param request - The incoming request.
	 * @param server - The {@link Server} that accepted it.
	 * @returns A new {@link Context}.
	 */
	contextFactory: ContextFactory = (request, server) => {
		return new Context(request, server);
	};

	/**
	 * Registers a {@link Middleware} under every {@link RouteBase.id} in
	 * {@link Middleware.routeIds}, so one instance can serve several routes.
	 *
	 * @param middleware - The {@link Middleware} to register.
	 */
	addMiddleware(middleware: Middleware): void {
		for (const routeId of middleware.routeIds) {
			const arr = this.middlewares.get(routeId);
			if (arr) arr.push(middleware);
			else this.middlewares.set(routeId, [middleware]);
		}
	}

	/**
	 * Resolves the {@link Middleware} instances that apply to a route, global ones
	 * first so they wrap the route-specific ones.
	 *
	 * @param routeId - The {@link RouteBase.id} to resolve for, or `"*"` to get
	 * only the global middlewares without duplicating them.
	 * @returns The middlewares in execution order.
	 */
	findMiddlewares(routeId: string): Array<Middleware> {
		const global = routeId === "*" ? [] : (this.middlewares.get("*") ?? []);
		const local = this.middlewares.get(routeId) ?? [];
		return [...global, ...local];
	}

	/**
	 * Logs a warning for every {@link Middleware} whose target
	 * {@link RouteBase.id} is not registered on this app and which therefore can
	 * never run — usually a typo or a route that was never attached.
	 *
	 * Runs from {@link App.createServer} rather than {@link App.addMiddleware},
	 * because registration order is not guaranteed and a middleware may legally be
	 * added before its route.
	 */
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

export { App };
export type { AppInterface };

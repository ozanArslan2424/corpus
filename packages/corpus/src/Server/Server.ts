import { Context } from "@/Context/Context";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { MiddlewareHandler } from "@/Middleware/types";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant, type ContextHandler } from "@/Route/types";
import { WebSocketRoute } from "@/Route/WebSocketRoute";
import type {
	ErrorHandler,
	ServerApp,
	ServerHandler,
	ServerOptions,
	ServerRouteMap,
	WebSocketHandler,
} from "@/Server/types";
import { arrIncludes } from "@/utils/arrays";
import { noop, type Func } from "@/utils/functions";
import { isEmpty } from "@/utils/is";
import { logger } from "@/utils/logger";
import type { OrString } from "@/utils/strings";
import type { nil } from "@/utils/types";
import { XConfig } from "@/XConfig/XConfig";

const NOT_FOUND_CHAIN = "NOT_FOUND_CHAIN";

/**
 * Server is the entrypoint to the app. It must be initialized before registering routes and middlewares.
 * ".listen()" to start listening.
 */
export class Server {
	constructor(protected readonly opts: ServerOptions) {
		this.port = opts.port;
		if (opts.hostname) this.hostname = opts.hostname;
	}
	port: number;
	hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost"> = "0.0.0.0";

	protected app: ServerApp | undefined;

	/** routeId -> fully composed chain (middlewares + terminal handler) */
	private readonly handlers = new Map<string, MiddlewareHandler>();

	get routes(): Array<BaseRoute> {
		return $registry.router.list();
	}

	setGlobalPrefix(value: string): void {
		$registry.prefix = value;
	}

	async listen(): Promise<void> {
		try {
			process.on("SIGINT", () => this.close());
			process.on("SIGTERM", () => this.close());

			await this.handleBeforeListen?.();

			this.getApp();
		} catch (err) {
			logger.error(err);
			await this.close();
		}
	}

	async close(closeActiveConnections: boolean = true): Promise<void> {
		await this.handleBeforeClose?.();
		await this.app?.stop(closeActiveConnections);
		if (XConfig.nodeEnv !== "test") process.exit(0);
	}

	protected getApp(): ServerApp {
		if (this.app) return this.app;

		this.composeHandlers();
		// const routes = this.composeRoutes();
		// const fetch = this.composeFetch();
		const websocket = this.composeWebsocket();

		this.app = Bun.serve<WebSocketRoute>({
			port: this.port,
			hostname: this.hostname,
			idleTimeout: this.opts?.idleTimeout,
			tls: this.opts?.tls,
			// fetch,
			// routes,
			websocket,
			// error: (err) => {
			// 	const context = (err as any).context as Context;
			// 	return this.withContext(context.req, context.server, (c) => this.handleError(err, c));
			// },
			fetch: (request, server) => this.handle(request, server),
		});

		return this.app;
	}

	protected getHandler(routeId: string): MiddlewareHandler | null {
		return this.handlers.get(routeId) ?? null;
	}

	/**
	 * Builds one complete handler per route (global + local middlewares + terminal)
	 * and caches it by route id. Runs once, before listen starts the server.
	 * Also builds the shared not-found chain (global middlewares + not-found terminal).
	 */
	protected composeHandlers(): void {
		this.handlers.clear();

		for (const route of $registry.router.list()) {
			this.handlers.set(
				route.id,
				this.compose(route.id, (c) => route.handler(c)),
			);
		}

		const notFoundChain = this.compose("*", (c) => this.handleNotFound(c));
		this.handlers.set(NOT_FOUND_CHAIN, notFoundChain);
	}

	/** koa-style onion dispatch with auto-next. */
	private compose(routeId: string, terminal: ContextHandler): MiddlewareHandler {
		const middlewares = $registry.middlewareRouter.find(routeId);
		const handlers = [...middlewares, terminal];

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
					const result = await handler(c, next);
					if (result !== undefined) return result; // terminal body OR middleware Res short-circuit
					if (!called) return next();
					return downstream;
				})();
			};
			return dispatch(0);
		};
	}

	// private withRethrow(handler: ContextHandler): ContextHandler {
	// 	return async (c) => {
	// 		try {
	// 			return await handler(c);
	// 		} catch (err) {
	// 			const error = err as Error;
	// 			Object.assign(error, { context: c });
	// 			throw err;
	// 			// return await this.handleError(err as Error, c);
	// 		}
	// 	};
	// }

	private async withContext(
		request: Request,
		server: ServerApp | nil,
		handler: ContextHandler,
	): Promise<Response> {
		const c = new Context(request, server);
		const result = await handler(c);

		if (result instanceof Res) c.res = result;
		else if (result !== undefined) c.res.body = result;

		// CORS must come last and be separate from other middlewares
		await $registry.cors?.handler(c, noop);
		return c.res.response;
	}

	protected composeRoutes(): ServerRouteMap {
		const routes: ServerRouteMap = {};
		const registeredRoutes = $registry.router.list();

		for (const route of registeredRoutes) {
			const handler = this.compose(route.id, (c) => route.handler(c));
			const isWildcard = route.endpoint.endsWith("*");

			routes[route.endpoint] ??= {};
			routes[route.endpoint]![route.method] = (request, server) =>
				this.withContext(request, server, (c) => {
					// Bun doesn't handle wildcards as params
					const params = { ...request.params };
					if (isWildcard) {
						const prefix = route.endpoint.slice(0, -1);
						const prefixIndex = request.url.indexOf(prefix);
						const wildcardValue = request.url.slice(prefixIndex + prefix.length).split("?")[0];
						if (wildcardValue) params["*"] = decodeURIComponent(wildcardValue);
					}
					return this.handleRoute(route, params, handler, c);
				});
		}
		return routes;
	}

	protected composeFetch(): ServerHandler {
		const notFoundChain = this.compose("*", (c) => this.handleNotFound(c));

		return (request: Bun.BunRequest, server: ServerApp) =>
			this.withContext(request, server, (c) => {
				const isPreflight =
					c.req.method === Method.OPTIONS &&
					c.req.headers.has(HeaderKey.AccessControlRequestMethod);
				if (isPreflight) {
					return this.handlePreflight(c);
				}
				return notFoundChain(c, noop);
			});
	}

	protected composeWebsocket(): WebSocketHandler {
		return {
			open: (ws) => ws.data.onOpen?.(ws),
			message: (ws, msg) => ws.data.onMessage?.(ws, msg),
			close: (ws, code, reason) => ws.data.onClose?.(ws, code, reason),
		};
	}

	async handle(request: Request, server?: ServerApp | nil): Promise<Response> {
		// const app = server ?? this.getApp();
		// app.stop();
		// return await app.fetch(request);

		return this.withContext(request, server, async (c) => {
			try {
				const isPreflight =
					c.req.method === Method.OPTIONS &&
					c.req.headers.has(HeaderKey.AccessControlRequestMethod);
				if (isPreflight) {
					return await this.handlePreflight(c);
				}

				const match = $registry.router.find(c.req.method, c.req.url);
				const route = match?.route;
				const params = match?.params;

				const handler = this.getHandler(route?.id ?? NOT_FOUND_CHAIN);
				if (!handler) {
					throw new Exception("Route not composed", Status.INTERNAL_SERVER_ERROR);
				}
				if (!route) {
					return await handler(c, noop);
				}

				return await this.handleRoute(route, params, handler, c);
			} catch (err) {
				return await this.handleError(err as Error, c);
			}
		});
	}

	protected async handleRoute(
		route: BaseRoute,
		params: Record<string, string> | undefined,
		handler: MiddlewareHandler,
		c: Context,
	): Promise<unknown> {
		const isWebsocket = route.variant === RouteVariant.websocket;
		const isMethodWithoutBody = arrIncludes(route.method, [Method.GET, Method.HEAD]);

		if (!isEmpty(params)) {
			c.params = $registry.urlParamsParser.parse(params);
		}
		if (route.model?.params) {
			c.params = await $registry.schemaParser.parse("params", c.params, route.model.params);
		}

		const qIndex = c.req.url.indexOf("?");
		if (qIndex !== -1) {
			const search = new URLSearchParams(c.req.url.slice(qIndex + 1));
			c.search = $registry.searchParamsParser.parse(search);
		}
		if (route.model?.search) {
			c.search = await $registry.schemaParser.parse("search", c.search, route.model.search);
		}

		if (isWebsocket) {
			const upgraded = c.server?.upgrade(c.req, {
				data: (await handler(c, noop)) as WebSocketRoute,
			});
			if (upgraded === false) throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
			return undefined;
		}

		if (!isMethodWithoutBody) {
			c.rawBody = await $registry.bodyParser.parse(c.req);
			c.body = await $registry.schemaParser.parse("body", c.rawBody, route.model?.body);
		}

		return await handler(c, noop);
	}

	handleBeforeListen: Func<[], Bun.MaybePromise<void>> | undefined;

	handleBeforeClose: Func<[], Bun.MaybePromise<void>> | undefined;

	/**
	 *
	 * Default error handler response will have a status of C.Error or 500 and json:
	 *
	 * ```typescript
	 * { error: unknown | true, message: string }
	 * ```
	 *
	 * If throw something other than an Error instance, you should probably handle it.
	 * However the default response will have a status of 500 and json:
	 *
	 * ```typescript
	 * { error: Instance, message: "Unknown" }
	 * ```
	 */
	handleError: ErrorHandler = (err) => {
		if (err instanceof Exception) return err.response;
		return new Res(
			{ error: err, message: "message" in err ? err.message : "Unknown" },
			{ status: Status.INTERNAL_SERVER_ERROR },
		);
	};

	/**
	 *
	 * Default not found handler response will have a status of 404 and json:
	 *
	 * ```typescript
	 * { error: true, message: `${c.req.method} on ${c.req.url} does not exist.` }
	 * ```
	 */
	handleNotFound: ContextHandler = (c) => {
		return new Res(
			{ error: true, message: `${c.req.method} on ${c.req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	handlePreflight: ContextHandler = (c) => {
		if ($registry.cors === null) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		return $registry.cors.handlePreflight(c);
	};
}

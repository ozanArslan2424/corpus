import { Context } from "@/Context/Context";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { MiddlewareHandler } from "@/Middleware/types";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import { RouteVariant, type ContextHandler } from "@/Route/types";
import { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { RouterData } from "@/Router/types";
import type { ErrorHandler, ServerApp, ServerOptions } from "@/Server/types";
import { noop, type Func } from "@/utils/functions";
import { logger, logFatal } from "@/utils/logger";
import type { OrString } from "@/utils/strings";
import type { nil } from "@/utils/types";
import { XConfig } from "@/XConfig/XConfig";

const NOT_FOUND_CHAIN = "NOT_FOUND_CHAIN";

/**
 * Server is the entrypoint to the app. It must be initialized before registering routes and middlewares.
 * ".listen()" to start listening.
 */
export class Server {
	constructor(protected readonly opts?: ServerOptions) {}

	protected app: ServerApp | undefined;

	/** routeId -> fully composed chain (middlewares + terminal handler) */
	private readonly handlers = new Map<string, MiddlewareHandler>();

	get routes(): Array<RouterData> {
		return $registry.router.list();
	}

	setGlobalPrefix(value: string): void {
		$registry.prefix = value;
	}

	async listen(
		port: number,
		hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost"> = "0.0.0.0",
	): Promise<void> {
		try {
			process.on("SIGINT", () => this.close());
			process.on("SIGTERM", () => this.close());
			logger.log(`Listening on ${hostname}:${port}`);

			this.precompile();
			await this.handleBeforeListen?.();

			this.app = Bun.serve<WebSocketRoute>({
				port,
				hostname,
				idleTimeout: this.opts?.idleTimeout,
				tls: this.opts?.tls,
				fetch: (req, server) => this.handleRequest(req, server),
				websocket: {
					open: (ws) => ws.data.onOpen?.(ws),
					message: (ws, msg) => ws.data.onMessage?.(ws, msg),
					close: (ws, code, reason) => ws.data.onClose?.(ws, code, reason),
				},
			});
		} catch (err) {
			logger.error("Server unable to start:", err);
			await this.close();
		}
	}

	async close(closeActiveConnections: boolean = true): Promise<void> {
		await this.handleBeforeClose?.();
		await this.app?.stop(closeActiveConnections);
		if (XConfig.nodeEnv !== "test") process.exit(0);
	}

	async handle(request: Request, server?: ServerApp | nil): Promise<Response> {
		const res = await this.handleRequest(request, server);
		if (!res) logFatal("WebSocket requests cannot be handled with this method.");
		return res;
	}

	/**
	 * Builds one complete handler per route (global + local middlewares + terminal)
	 * and caches it by route id. Runs once, before listen starts the server.
	 * Also builds the shared not-found chain (global middlewares + not-found terminal).
	 */
	protected precompile(): void {
		this.handlers.clear();

		for (const route of $registry.router.list()) {
			this.handlers.set(
				route.id,
				this.compose(route.id, async (c) => {
					if (route.variant !== RouteVariant.websocket) {
						await c.parseData({
							params: c.params as Record<string, string>,
							bodyValidator: route.validators?.body,
							paramsValidator: route.validators?.params,
							searchValidator: route.validators?.search,
						});
					}
					return route.handler(c);
				}),
			);
		}

		const notFoundChain = this.compose("*", (c) => this.handleNotFound(c));
		this.handlers.set(NOT_FOUND_CHAIN, notFoundChain);
	}

	/** koa-style onion dispatch with auto-next. */
	protected compose(routeId: string, terminal: ContextHandler): MiddlewareHandler {
		const handlers = [...$registry.middlewareRouter.find(routeId), terminal];
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

	protected async handleRequest(
		req: Request,
		server: ServerApp | nil,
	): Promise<Response | undefined> {
		const c = new Context(req, server);

		if (this.isPreflight(c.req.method, c.req.headers)) {
			const result = await this.handlePreflight(c);
			if (result instanceof Res) c.res = result;
			else c.res.body = result;
		} else {
			try {
				const match = $registry.router.find(c.req.method, c.req.url);

				let handler: MiddlewareHandler | undefined;
				if (!match) {
					handler = this.handlers.get(NOT_FOUND_CHAIN);
				} else {
					handler = this.handlers.get(match.route.id);
					c.params = match.params;
				}

				if (!handler) throw new Exception("Route not composed", Status.INTERNAL_SERVER_ERROR);
				const result = await handler(c, noop);

				if (this.isWebsocket(c.req.headers)) {
					const upgraded = c.server?.upgrade(c.req, { data: result as WebSocketRoute });
					if (upgraded === false) throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
					return undefined;
				} else if (result instanceof Res) {
					c.res = result;
				} else if (result !== undefined) {
					c.res.body = result;
				}
			} catch (err) {
				const result = await this.handleError(err as Error, c);
				if (result instanceof Res) c.res = result;
				else c.res.body = result;
			}
		}

		await $registry.cors?.handler(c, noop);
		return c.res.response;
	}

	protected handleBeforeListen: Func<[], Bun.MaybePromise<void>> | undefined;
	setOnBeforeListen(handler: Func<[], Bun.MaybePromise<void>> | undefined): void {
		this.handleBeforeListen = handler;
	}
	defaultOnBeforeListen: Func<[], Bun.MaybePromise<void>> | undefined = undefined;

	protected handleBeforeClose: Func<[], Bun.MaybePromise<void>> | undefined;
	setOnBeforeClose(handler: () => Bun.MaybePromise<void>): void {
		this.handleBeforeClose = handler;
	}
	defaultOnBeforeClose: Func<[], Bun.MaybePromise<void>> | undefined = undefined;

	protected handleError: ErrorHandler = (err, c) => this.defaultErrorHandler(err, c);
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
	setOnError(handler: ErrorHandler): void {
		this.handleError = handler;
	}
	defaultErrorHandler: ErrorHandler = (err) => {
		if (err instanceof Exception) return err.response;
		return new Res(
			{ error: err, message: "message" in err ? err.message : "Unknown" },
			{ status: Status.INTERNAL_SERVER_ERROR },
		);
	};

	protected handleNotFound: ContextHandler = (c) => this.defaultNotFoundHandler(c);
	/**
	 *
	 * Default not found handler response will have a status of 404 and json:
	 *
	 * ```typescript
	 * { error: true, message: `${c.req.method} on ${c.req.url} does not exist.` }
	 * ```
	 */
	setOnNotFound(handler: ContextHandler): void {
		this.handleNotFound = handler;
	}
	defaultNotFoundHandler: ContextHandler = (c) => {
		return new Res(
			{ error: true, message: `${c.req.method} on ${c.req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	protected handlePreflight: ContextHandler = async (c) => {
		if ($registry.cors === null) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		return $registry.cors.handlePreflight(c);
	};

	private isPreflight(method: string, headers: Headers): boolean {
		return (
			method.toUpperCase() === Method.OPTIONS && headers.has(HeaderKey.AccessControlRequestMethod)
		);
	}

	private isWebsocket(headers: Headers): boolean {
		return (
			headers.get(HeaderKey.Connection)?.toLowerCase() === "upgrade" &&
			headers.get(HeaderKey.Upgrade)?.toLowerCase() === "websocket"
		);
	}
}

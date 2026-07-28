import { Context } from "@/Context/Context";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import { RouteVariant, type ContextHandler } from "@/Route/types";
import { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { RouterData } from "@/Router/types";
import type { ErrorHandler, ServerApp, ServerOptions } from "@/Server/types";
import type { Func } from "@/utils/functions";
import { logger, logFatal } from "@/utils/logger";
import type { OrString } from "@/utils/strings";
import type { nil } from "@/utils/types";
import { XConfig } from "@/XConfig/XConfig";

/**
 * Server is the entrypoint to the app. It must be initialized before registering routes and middlewares.
 * ".listen()" to start listening.
 */
export class Server {
	constructor(protected readonly opts?: ServerOptions) {}

	protected app: ServerApp | undefined;

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
			await this.handleBeforeListen?.();
			this.app = this.createApp(port, hostname);
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
		try {
			const res = await this.handleRequest(request, server);
			if (!res) logFatal("WebSocket requests cannot be handled with this method.");
			return res.response;
		} catch {
			logFatal("WebSocket requests cannot be handled with this method.");
		}
	}

	private createApp(
		port: number,
		hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">,
	): ServerApp {
		return Bun.serve<WebSocketRoute>({
			port,
			hostname,
			idleTimeout: this.opts?.idleTimeout,
			tls: this.opts?.tls,
			fetch: async (request, server) => {
				const res = await this.handleRequest(request, server);
				return res?.response;
			},
			websocket: {
				async open(ws) {
					await ws.data.onOpen?.(ws);
				},
				async message(ws, message) {
					await ws.data.onMessage(ws, message);
				},
				async close(ws, code, reason) {
					await ws.data.onClose?.(ws, code, reason);
				},
			},
		});
	}

	protected async handleRequest(req: Request, server: ServerApp | nil): Promise<Res | null> {
		const c = new Context(req);

		if (this.isPreflight(req.method, req.headers)) {
			const result = await this.handlePreflight(c);
			if (result instanceof Res) c.res = result;
			else c.res.body = result;
		} else {
			try {
				const match = $registry.router.find(req);

				// gmw: global middlewares
				const gmw = $registry.middlewares.find("*");
				// gmwir: global middlewares inbound result
				const gmwir = await gmw.inbound?.(c);
				if (gmwir instanceof Res) return gmwir;

				if (!match) {
					const result = await this.handleNotFound(c);
					if (result instanceof Res) c.res = result;
					else c.res.body = result;
				} else {
					// lmw: local middlewares
					const lmw = $registry.middlewares.find(match.route.id);
					// lmwir: local middlewares inbound result
					const lmwir = await lmw.inbound?.(c);
					if (lmwir instanceof Res) return lmwir;

					await c.parseData(match);
					const result = await match.route.handler(c);

					if (this.isWebsocket(match.route.variant, req.headers)) {
						const upgraded = server?.upgrade(req, { data: result });
						if (!upgraded) throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
						console.log("returning null");
						return null;
					}

					if (result instanceof Res) c.res = result;
					else c.res.body = result;

					// lmwor: local middlewares outbound result
					const lmwor = await lmw.outbound?.(c);
					if (lmwor instanceof Res) return lmwor;
				}

				// gmwor: global middlewares outbound result
				const gmwor = await gmw.outbound?.(c);
				if (gmwor instanceof Res) return gmwor;
			} catch (err) {
				const result = await this.handleError(err as Error, c);
				if (result instanceof Res) c.res = result;
				else c.res.body = result;
			}
		}

		await $registry.cors?.handler(c);

		return c.res;
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

	private isWebsocket(variant: RouteVariant, headers: Headers): boolean {
		return (
			variant === RouteVariant.websocket &&
			headers.get(HeaderKey.Connection)?.toLowerCase() === "upgrade" &&
			headers.get(HeaderKey.Upgrade)?.toLowerCase() === "websocket"
		);
	}
}

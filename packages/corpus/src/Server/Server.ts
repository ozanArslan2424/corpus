import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { Context } from "@/Context/Context";
import { Exception } from "@/Exception/Exception";
import { $registry } from "@/registry";
import { Req } from "@/Req/Req";
import { Res } from "@/Res/Res";
import type { RouterData } from "@/Router/RouterData";
import type { ErrorHandler } from "@/Server/ErrorHandler";
import type { RequestHandler } from "@/Server/RequestHandler";
import type { ServerApp } from "@/Server/ServerApp";
import type { ServerInterface } from "@/Server/ServerInterface";
import type { ServerOptions } from "@/Server/ServerOptions";
import { Status } from "@/Status/Status";
import type { Func } from "@/utils/functions";
import { logger, logFatal } from "@/utils/logger";
import type { OrString } from "@/utils/strings";
import { WebSocketRoute } from "@/WebSocketRoute/WebSocketRoute";
import { XConfig } from "@/XConfig/XConfig";

/**
 * Server is the entrypoint to the app. It must be initialized before registering routes and middlewares.
 * ".listen()" to start listening.
 */

export class Server implements ServerInterface {
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

	async handle(request: Request): Promise<Response> {
		const req = new Req(request);
		const res = await this.handleRequest(req, () => null);
		if (!res) {
			logFatal("WebSocket requests cannot be handled with this method.");
		}
		return res.response;
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
				const req = new Req(request);
				const res = await this.handleRequest(req, (wsRoute) => {
					const upgraded = server.upgrade(request, { data: wsRoute });
					if (!upgraded) {
						throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
					}
					return null;
				});
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

	// gmw: global middlewares
	// gmwir: global middlewares inbound result
	// gmwor: global middlewares outbound result
	// lmw: local middlewares
	// lmwir: local middlewares inbound result
	// lmwor: local middlewares outbound result
	protected async handleRequest(
		req: Req,
		onUpgrade: Func<[WebSocketRoute], null>,
	): Promise<Res | null> {
		const ctx = new Context(req);

		try {
			if (ctx.req.isPreflight) {
				ctx.res = await this.handlePreflight(ctx.req);
			} else {
				const gmw = $registry.middlewares.find("*");

				const gmwir = await gmw.inbound(ctx);
				if (gmwir instanceof Res) return gmwir;

				const match = $registry.router.find(ctx.req);

				if (!match) {
					ctx.res = await this.handleNotFound(ctx.req);
				} else {
					const lmw = $registry.middlewares.find(match.route.id);

					const lmwir = await lmw.inbound(ctx);
					if (lmwir instanceof Res) return lmwir;

					await Context.appendParsedData(ctx, match);

					const routeResult = await match.route.handler(ctx);

					if (match.route.variant === RouteVariant.websocket && ctx.req.isWebsocket) {
						return onUpgrade(routeResult);
					} else if (routeResult instanceof Res) {
						ctx.res = routeResult;
					} else {
						ctx.res = new Res(routeResult, ctx.res);
					}

					const lmwor = await lmw.outbound(ctx);
					if (lmwor instanceof Res) return lmwor;
				}

				const gmwor = await gmw.outbound(ctx);
				if (gmwor instanceof Res) return gmwor;
			}
		} catch (err) {
			ctx.res = await this.handleError(err as Error, ctx);
		}

		await $registry.cors?.handler(ctx);

		return ctx.res;
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

	protected handleNotFound: RequestHandler = (req) => this.defaultNotFoundHandler(req);
	setOnNotFound(handler: RequestHandler): void {
		this.handleNotFound = handler;
	}
	defaultNotFoundHandler: RequestHandler = (req) => {
		return new Res(
			{ error: true, message: `${req.method} on ${req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	protected handlePreflight: RequestHandler = async (req) => {
		if (!$registry.cors) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		const handler = $registry.cors.getPreflightHandler();
		return handler(req);
	};
}

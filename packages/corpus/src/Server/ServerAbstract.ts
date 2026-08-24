import { arrIncludes } from "@ozanarslan/utils/array";
import { noop, type Func } from "@ozanarslan/utils/function";
import type { OrString } from "@ozanarslan/utils/lexical";
import { logger } from "@ozanarslan/utils/logger";
import { isEmpty, type Maybe } from "@ozanarslan/utils/maybe";

import { Context } from "@/Context/Context";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { MiddlewareHandler } from "@/Middleware/types";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant, type ContextHandler } from "@/Route/types";
import { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { ErrorHandler, ServerApp, ServerOptions } from "@/Server/types";
import { XConfig } from "@/XConfig/XConfig";

export abstract class ServerAbstract {
	abstract handle(request: Request, server?: Maybe<ServerApp>): Promise<Response>;

	port: number = 3000;
	hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	idleTimeout?: number;
	tls?: { cert: string | Buffer; key: string | Buffer; ca?: string | Buffer };

	async listen(): Promise<void> {
		try {
			process.on("SIGINT", () => this.close());
			process.on("SIGTERM", () => this.close());

			await this.handleBeforeListen?.();

			this.createApp();
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

	protected abstract createApp(): ServerApp;

	protected app: ServerApp | undefined;

	protected init(opts?: ServerOptions) {
		if (opts?.port) this.port = opts.port;
		if (opts?.hostname) this.hostname = opts.hostname;
		if (opts?.idleTimeout) this.idleTimeout = opts.idleTimeout;
		if (opts?.tls) this.tls = opts.tls;
		if (opts?.globalPrefix) $registry.prefix = opts.globalPrefix;
	}

	protected async finalize(context: Context, handler: ContextHandler): Promise<Response> {
		const result = await handler(context);

		if (result instanceof Res) context.res = result;
		else if (result !== undefined) context.res.body = result;

		// CORS must come last and be separate from other middlewares
		await $registry.cors?.handler(context, noop);
		return context.res.response;
	}

	protected composeHandlerChain(...handlers: Array<MiddlewareHandler>): MiddlewareHandler {
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

	handleRoute = async (
		context: Context,
		route: BaseRoute,
		params: Record<string, string> | undefined,
		composedHandler: MiddlewareHandler,
	): Promise<unknown> => {
		const isWebsocket = route.variant === RouteVariant.websocket;
		const isMethodWithoutBody = arrIncludes(route.method, [Method.GET, Method.HEAD]);

		if (!isEmpty(params)) {
			context.params = $registry.urlParamsParser.parse(params);
		}
		if (route.model?.params) {
			context.params = await $registry.schemaParser.parse(
				"params",
				context.params,
				route.model.params,
			);
		}

		const qIndex = context.req.url.indexOf("?");
		if (qIndex !== -1) {
			const search = new URLSearchParams(context.req.url.slice(qIndex + 1));
			context.search = $registry.searchParamsParser.parse(search);
		}
		if (route.model?.search) {
			context.search = await $registry.schemaParser.parse(
				"search",
				context.search,
				route.model.search,
			);
		}

		if (isWebsocket) {
			const upgraded = context.server?.upgrade(context.req, {
				data: (await composedHandler(context, noop)) as WebSocketRoute,
			});
			if (upgraded === false) throw new Exception("Upgrade failed", Status.UPGRADE_REQUIRED);
			return undefined;
		}

		if (!isMethodWithoutBody) {
			context.rawBody = await $registry.bodyParser.parse(context.req);
			context.body = await $registry.schemaParser.parse("body", context.rawBody, route.model?.body);
		}

		return await composedHandler(context, noop);
	};

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

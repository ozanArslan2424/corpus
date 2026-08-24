import { noop } from "@ozanarslan/utils/function";
import type { Maybe } from "@ozanarslan/utils/maybe";

import { Context } from "@/Context/Context";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import type { MiddlewareHandler } from "@/Middleware/types";
import { $registry } from "@/registry";
import { ServerAbstract } from "@/Server/ServerAbstract";
import type { ServerApp, ServerOptionsWithRouter } from "@/Server/types";

const NOT_FOUND_CHAIN = "NOT_FOUND_CHAIN";

export class ServerWithRouter extends ServerAbstract {
	constructor(opts: ServerOptionsWithRouter) {
		super();
		$registry.router = opts.router;
		this.init(opts);
	}

	async handle(request: Request, server?: Maybe<ServerApp>): Promise<Response> {
		const context = new Context(request, server);

		return this.finalize(context, async (c) => {
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
				const routeId = route?.id ?? NOT_FOUND_CHAIN;

				let handler = this.getComposedHandler(routeId);
				if (!handler) {
					const middlewareHandlers = $registry.router
						.findMiddlewares(routeId)
						.map((m) => m.handler);
					const terminal = route ? route.handler : this.handleNotFound;
					handler = this.composeHandlerChain(...middlewareHandlers, terminal);
				}
				if (!route) {
					return await handler(c, noop);
				}

				return await this.handleRoute(c, route, params, handler);
			} catch (err) {
				return await this.handleError(err as Error, c);
			}
		});
	}

	protected createApp(): ServerApp {
		if (this.app) return this.app;

		this.composeHandlers();

		this.app = Bun.serve({
			port: this.port,
			hostname: this.hostname,
			idleTimeout: this?.idleTimeout,
			tls: this?.tls,
			fetch: (request, server) => this.handle(request, server),
			websocket: {
				open: (ws) => ws.data.onOpen?.(ws),
				message: (ws, msg) => ws.data.onMessage?.(ws, msg),
				close: (ws, code, reason) => ws.data.onClose?.(ws, code, reason),
			},
		});

		return this.app;
	}

	/** routeId -> fully composed chain (middlewares + terminal handler) */
	private readonly composedHandlers = new Map<string, MiddlewareHandler>();

	/**
	 * Builds one complete handler per route (global + local middlewares + terminal)
	 * and caches it by route id. Runs once, before listen starts the server.
	 * Also builds the shared not-found chain (global middlewares + not-found terminal).
	 */
	protected composeHandlers(): void {
		this.composedHandlers.clear();

		for (const route of $registry.router.list()) {
			this.composedHandlers.set(
				route.id,
				this.composeHandlerChain(
					...$registry.router.findMiddlewares(route.id).map((m) => m.handler),
					(c) => route.handler(c),
				),
			);
		}

		const notFoundChain = this.composeHandlerChain(
			...$registry.router.findMiddlewares("*").map((m) => m.handler),
			(c) => this.handleNotFound(c),
		);

		this.composedHandlers.set(NOT_FOUND_CHAIN, notFoundChain);
	}

	protected getComposedHandler(routeId: string): MiddlewareHandler | null {
		return this.composedHandlers.get(routeId) ?? null;
	}
}

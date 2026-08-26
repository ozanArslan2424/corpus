import { noop, type Maybe } from "@ozanarslan/utils";

import { Context } from "@/C/Context";
import { HeaderKey } from "@/C/HeaderKey";
import { Method } from "@/C/Method";
import type { ContextHandler } from "@/C/Route/types";
import { composeHandlerChain } from "@/C/Server/composeHandlerChain";
import type { ServerApp, ServerHandler, ServerOptions, ServerRouteMap } from "@/C/Server/types";
import { ServerAbstract } from "@/C/ServerAbstract";
import { $registry } from "@/Registry/$registry";

export class Server extends ServerAbstract {
	constructor(opts?: ServerOptions) {
		super();
		this.init(opts);
	}

	async handle(request: Request, server?: Maybe<ServerApp>): Promise<Response> {
		// TODO: This is how it should be but Bun.Server.fetch only handles the fetch argument
		// when it should also handle the routes argument. I'm not sure why this is the case
		// or if it is the case at all. it just doesn't work. Temporary regex matcher is used.
		//
		// const app = this.createApp() ?? server;
		// // // change the request base url to $registry.baseUrl first
		// // const url = new URL(new URL(request.url).pathname, $registry.baseUrl);
		// // request = new Request(url, request);
		// app.stop();
		// return await app.fetch(request);

		const context = this.contextFactory(request, server);
		return this.finalize(context, async (c) => {
			try {
				const isPreflight =
					c.req.method === Method.OPTIONS &&
					c.req.headers.has(HeaderKey.AccessControlRequestMethod);
				if (isPreflight) {
					return await this.handlePreflight(c);
				}

				const match = $registry.router.find(c.req.method, c.req.url);
				if (match) {
					const composedHandler = composeHandlerChain(
						...match.middlewares.map((m) => m.handler),
						match.route.handler,
					);
					return await this.handleRoute(c, match.route, match.params, composedHandler);
				}
				const notFoundHandler = composeHandlerChain(
					...$registry.router.findMiddlewares("*").map((m) => m.handler),
					this.handleNotFound,
				);
				return await notFoundHandler(c, noop);
			} catch (err) {
				return await this.handleError(err as Error, c);
			}
		});
	}

	protected createApp(): ServerApp {
		if (this.app) return this.app;

		this.app = Bun.serve({
			port: this.port,
			hostname: this.hostname,
			idleTimeout: this?.idleTimeout,
			tls: this?.tls,
			fetch: this.composeFetch(),
			routes: this.composeRoutes(),
			websocket: {
				open: (ws) => ws.data.onOpen?.(ws),
				message: (ws, msg) => ws.data.onMessage?.(ws, msg),
				close: (ws, code, reason) => ws.data.onClose?.(ws, code, reason),
			},
			error: (err) =>
				this.finalize((err as Error & { context: Context }).context, (c) =>
					this.handleError(err, c),
				),
		});

		return this.app;
	}

	protected composeRoutes(): ServerRouteMap {
		const routes: ServerRouteMap = {};

		for (const route of $registry.router.list()) {
			const handler = composeHandlerChain(
				...$registry.router.findMiddlewares(route.id).map((m) => m.handler),
				route.handler,
			);
			const isWildcard = route.endpoint.endsWith("*");

			routes[route.endpoint] ??= {};
			routes[route.endpoint]![route.method] = (request, server) => {
				const context = this.contextFactory(request, server);
				return this.finalize(
					context,
					this.assignErrorContext((c) => {
						// Bun doesn't handle wildcards as params
						const params = { ...request.params };
						if (isWildcard) {
							const prefix = route.endpoint.slice(0, -1);
							const prefixIndex = request.url.indexOf(prefix);
							const wildcardValue = request.url.slice(prefixIndex + prefix.length).split("?")[0];
							if (wildcardValue) params["*"] = decodeURIComponent(wildcardValue);
						}
						return this.handleRoute(c, route, params, handler);
					}),
				);
			};
		}

		return routes;
	}

	protected composeFetch(): ServerHandler {
		const notFoundChain = composeHandlerChain(
			...$registry.router.findMiddlewares("*").map((m) => m.handler),
			this.handleNotFound,
		);

		return (request, server) => {
			const context = this.contextFactory(request, server);
			return this.finalize(
				context,
				this.assignErrorContext(async (c) => {
					const isPreflight =
						c.req.method === Method.OPTIONS &&
						c.req.headers.has(HeaderKey.AccessControlRequestMethod);
					if (isPreflight) {
						return await this.handlePreflight(c);
					}
					return await notFoundChain(c, noop);
				}),
			);
		};
	}

	protected assignErrorContext(handler: ContextHandler): ContextHandler {
		return async (c) => {
			try {
				return await handler(c);
			} catch (err) {
				// we use bun's native error handler by appending the context to the error
				Object.assign(err as Error, { context: c });
				throw err;
			}
		};
	}
}

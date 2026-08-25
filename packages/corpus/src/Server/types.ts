import type { Func, OrString, Maybe, Optional } from "@ozanarslan/utils";

import type { Context } from "@/Context/Context";
import type { Method } from "@/enums/Method";
import type { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { RouterInterface } from "@/types";

export interface ServerOptions {
	port?: number;
	globalPrefix?: string;
	hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	idleTimeout?: number;
	tls?: {
		cert: string | Buffer;
		key: string | Buffer;
		ca?: string | Buffer;
	};
}

export interface ServerOptionsWithRouter extends ServerOptions {
	router: RouterInterface;
}

export type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;
export type WebSocketHandler = Bun.WebSocketHandler<WebSocketRoute>;

export type ServerApp = Bun.Server<WebSocketRoute>;

export type ErrorHandler<R = unknown> = Func<[error: Error, context: Context], Bun.MaybePromise<R>>;

export type ServerHandler<Req extends Request = Request> = Func<
	[request: Req, server: Maybe<ServerApp>],
	Bun.MaybePromise<Optional<Response>>
>;

export type ContextFactory<Req extends Request = Request> = Func<
	[request: Req, server: Maybe<ServerApp>],
	Context
>;

export type ServerRouteMap = Record<string, Partial<Record<Method, ServerHandler<Bun.BunRequest>>>>;

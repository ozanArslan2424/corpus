import type { Context } from "@/Context/Context";
import type { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { Func } from "@/utils/functions";

export type ServerOptions = {
	idleTimeout?: number;
	tls?: {
		cert: string | Buffer;
		key: string | Buffer;
		ca?: string | Buffer;
	};
};

export type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;

export type ServerApp = Bun.Server<WebSocketRoute>;

export type ErrorHandler<R = unknown> = Func<[Error, Context], Bun.MaybePromise<R>>;

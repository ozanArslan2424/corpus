import type { Context } from "@/Context/Context";
import type { Method } from "@/enums/Method";
import type { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { Func } from "@/utils/functions";
import type { OrString } from "@/utils/strings";

export type ServerOptions = {
	port: number;
	hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
	idleTimeout?: number;
	tls?: {
		cert: string | Buffer;
		key: string | Buffer;
		ca?: string | Buffer;
	};
};

export type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;
export type WebSocketHandler = Bun.WebSocketHandler<WebSocketRoute>;

export type ServerApp = Bun.Server<WebSocketRoute>;

export type ErrorHandler<R = unknown> = Func<[error: Error, context: Context], Bun.MaybePromise<R>>;

export type ServerHandler = Func<
	[request: Bun.BunRequest, server: ServerApp],
	Bun.MaybePromise<Response | undefined>
>;

export type ServerRouteMap = Record<string, Partial<Record<Method, ServerHandler>>>;

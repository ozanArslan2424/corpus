import type { Context } from "@/Context/Context";
import type { RouterAdapterInterface } from "@/Registry/types";
import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";
import type { WebSocketRoute } from "@/Route/WebSocketRoute";
import type { Func } from "@/utils/functions";

export type ServerOptions = {
	adapter?: RouterAdapterInterface;
	idleTimeout?: number;
	tls?: {
		cert: string | Buffer;
		key: string | Buffer;
		ca?: string | Buffer;
	};
};

export type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;

export type ServerApp = Bun.Server<WebSocketRoute>;

export type RequestHandler<R = unknown> = Func<[Req], Bun.MaybePromise<Res<R>>>;

export type ErrorHandler<R = unknown> = Func<[Error, Context], Bun.MaybePromise<Res<R>>>;

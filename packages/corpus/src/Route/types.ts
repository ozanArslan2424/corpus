import { enumerate, type ValueOf } from "@ozanarslan/utils";
import type { Func } from "@ozanarslan/utils";
import type { Schema } from "@ozanarslan/utils";

import type { Context } from "@/Context/Context";
import type { CacheControlDirective } from "@/Directives/CacheControlDirective";
import type { ContentDispositionDirective } from "@/Directives/ContentDispositionDirective";
import type { Method } from "@/enums/Method";
import type { Res } from "@/Res/Res";
import type { ServerWebSocket } from "@/Server/types";

export type ContextHandler<B = unknown, S = unknown, P = unknown, R = unknown> = Func<
	[context: Context<B, S, P, R>],
	Bun.MaybePromise<R>
>;

export const RouteVariant = enumerate({
	static: "static",
	file: "file",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
});

export type RouteVariant = ValueOf<typeof RouteVariant>;

export type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| `${Lowercase<Method>} ${E}`
	| { method: Method; path: E };

export type RouteConfig = {
	maxRequestBodySize?: number;
};

export type RouteModel<B = unknown, S = unknown, P = unknown, R = unknown> = {
	config?: RouteConfig;
	response?: Schema<R>;
	body?: Schema<B>;
	search?: Schema<S>;
	params?: Schema<P>;
};

export type BundleRouteCacheConfig = {
	/** Strategy for index.html */
	indexHtml: CacheControlDirective;
	/** Strategy for the assets folder */
	assetsDir: CacheControlDirective;
	/** Optional: Strategy for other root files (favicon, robots.txt, etc.) */
	fallback?: CacheControlDirective;
};

export type StaticRouteRes = ReadableStream<Uint8Array> | string | Res;

export type WebSocketOnOpen = Func<[ws: ServerWebSocket], Bun.MaybePromise<void>>;
export type WebSocketOnClose = Func<
	[ws: ServerWebSocket, code?: number, reason?: string],
	Bun.MaybePromise<void>
>;
export type WebSocketOnMessage = Func<
	[ws: ServerWebSocket, message: string | Buffer],
	Bun.MaybePromise<void>
>;

export type WebSocketRouteCallbacks = {
	onOpen?: WebSocketOnOpen;
	onClose?: WebSocketOnClose;
	onMessage: WebSocketOnMessage;
};

export type FileRouteDefinition = {
	filePath: string;
	disposition?: ContentDispositionDirective["disposition"];
	cache?: CacheControlDirective;
};

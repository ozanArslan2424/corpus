import type { CacheControlDirective } from "@/CacheControlDirective/CacheControlDirective";
import type { Method } from "@/enums/Method";
import type { Res } from "@/Res/Res";
import type { ServerWebSocket } from "@/Server/types";
import type { Func } from "@/utils/functions";
import type { Schema } from "@/utils/Schema";
import type { ValueOf } from "@/utils/ValueOf";

export const RouteVariant = {
	static: "static",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
} as const;

export type RouteVariant = ValueOf<typeof RouteVariant>;

export type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| { method: Method; path: E };

export type RouteModel<B = unknown, S = unknown, P = unknown, R = unknown> = {
	response?: Schema<R>;
	body?: Schema<B>;
	search?: Schema<S>;
	params?: Schema<P>;
};

export type BundleRouteCacheConfig = {
	/** Strategy for index.html */
	indexHtml: CacheControlDirective;
	/** Strategy for the /assets/ folder */
	assetsDir: CacheControlDirective;
	/** Optional: Strategy for other root files (favicon, robots.txt, etc.) */
	fallback?: CacheControlDirective;
};

export type StaticRouteRes = Res | string;

export type WebSocketRouteDefinition = {
	onOpen?: Func<[ws: ServerWebSocket], Bun.MaybePromise<void>>;
	onClose?: Func<[ws: ServerWebSocket, code?: number, reason?: string], Bun.MaybePromise<void>>;
	onMessage: Func<[ws: ServerWebSocket, message: string | Buffer], Bun.MaybePromise<void>>;
};

export type StaticRouteDefinition =
	// just the file path, doesn't stream
	| string
	| {
			filePath: string;
			disposition?: "attachment" | "inline";
			cache?: CacheControlDirective;
	  };

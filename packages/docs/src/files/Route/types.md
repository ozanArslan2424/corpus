# Route types

```ts
export const RouteVariant = {
	static: "static",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
} as const;

export type RouteVariant = ValueOf<typeof RouteVariant>;

export type RouteAddress<E extends string = string> =
	E | `${Method} ${E}` | { method: Method; path: E };

export type RouteModel<B = unknown, S = unknown, P = unknown, R = unknown> = {
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

export type StaticRouteRes = Res | string;

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

export type StaticRouteDefinition =
	// just the file path, doesn't stream
	| string
	| {
			filePath: string;
			disposition?: "attachment" | "inline";
			cache?: CacheControlDirective;
	  };
```

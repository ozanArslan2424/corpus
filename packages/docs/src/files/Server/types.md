# Server types

```ts
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

export type RequestHandler<R = unknown> = Func<[Req], Bun.MaybePromise<Res<R>>>;

export type ErrorHandler<R = unknown> = Func<[Error, Context], Bun.MaybePromise<Res<R>>>;
```

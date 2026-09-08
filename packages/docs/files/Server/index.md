# Server

Type aliases for Bun's server primitives, parameterized for corpus.

Bun's server and socket types take the per-connection data type as a
parameter. Corpus always stores a `WebSocketRoute` there — that is how a
live socket knows which route's callbacks to invoke — so these aliases pin it
once instead of at every use site.

Nothing here is a runtime construct; these are the shapes `App` builds
and hands to `Bun.serve`.

## Server

_type_

```ts
type Server = Bun.Server<WebSocketRoute>;
```

The running Bun server, as held by [`App.server`](../App/index.md#app-server).

## ServerHandler

_type_

```ts
type ServerHandler = (request: Request, server: Maybe<Server>) => MaybePromise<Optional<Response>>;
```

A compiled request handler, as produced by [`App.finalize`](../App/index.md#app-finalize).

This is the form both a route map entry and the `fetch` fallback take. The
response is optional because a `WebSocketRoute` upgrades the connection
instead of responding.

**Parameters**

- `request` — The incoming request.
- `server` — The `Server` that accepted it.

**Returns** — The response, or nothing when the connection was upgraded.

## ServerRouteMap

_type_

```ts
type ServerRouteMap = Record<string, Partial<Record<Method, ServerHandler>>>;
```

The route table handed to `Bun.serve`, keyed by endpoint and then by
[`Method`](../Request/index.md#method). Built by [`App.composeRoutes`](../App/index.md#app-composeroutes); anything it does not match
falls through to [`App.composeFetch`](../App/index.md#app-composefetch).

## ServerWebSocket

_type_

```ts
type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;
```

A live WebSocket connection. Its `data` is the `WebSocketRoute` that
accepted the upgrade, which is what [`App.createServer`](../App/index.md#app-createserver) dispatches the
open, message and close events through.

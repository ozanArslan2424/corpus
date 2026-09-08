# WebSocketRoute

WebSocket endpoints.

`WebSocketRoute` is the [`RouteVariant.websocket`](../RouteBase/index.md#routevariant-websocket) member of the
`RouteBase` family. It is the one route kind that does not produce a
response: [`App.composeRoutes`](../App/index.md#app-composeroutes) sees the variant and upgrades the
connection instead, storing the route itself as the socket's data so that
every later event can be dispatched back to its callbacks.

```ts
import { WebSocketRoute } from "@ozanarslan/corpus";

new WebSocketRoute("/chat", {
	onOpen: (ws) => ws.subscribe("room"),
	onMessage: (ws, message) => ws.publish("room", message),
});
```

Since one route instance backs every connection to that endpoint, per-socket
state belongs on the socket — through Bun's `subscribe`/`publish` or a map
keyed by socket — not on the route.

## WebSocketRoute

_class_

```ts
class WebSocketRoute<E extends string = string>extends RouteBase<never, never, never, WebSocketRoute, E>
```

A WebSocket endpoint.

Constructing one registers it on the nearest `App`, which upgrades
matching requests rather than responding to them. The callbacks are shared by
every connection to the endpoint, and each event receives the socket it
concerns.

**Type parameters**

- `E` — The literal endpoint type, carried so the endpoint stays narrowly typed at the call site.

### WebSocketRoute.constructor()

```ts
constructor();
constructor(endpoint: E, definition: WebSocketRouteDefinition);
constructor(endpoint?: E, definition?: WebSocketRouteDefinition)
```

Creates a websocket route for subclasses, which declare
[`WebSocketRoute.endpoint`](#websocketroute-endpoint) and the callbacks as class fields and call
[`RouteBase.register`](../RouteBase/index.md#routebase-register) themselves.

Creates a websocket route and registers it on the nearest `App`.

**Parameters**

- `endpoint` — The path clients connect to.
- `definition` — The [`WebSocketRouteDefinition`](#websocketroutedefinition) holding the socket lifecycle callbacks.

### WebSocketRoute.variant

```ts
override readonly variant: RouteVariant
```

Marks this route as [`RouteVariant.websocket`](../RouteBase/index.md#routevariant-websocket), which is what tells
[`App.composeRoutes`](../App/index.md#app-composeroutes) to upgrade rather than respond.

### WebSocketRoute.method

```ts
override readonly method: Method
```

Always [`Method.GET`](../Request/index.md#method-get) — an upgrade handshake is a GET request.

### WebSocketRoute.endpoint

```ts
override endpoint!: E
```

The path clients connect to.

### WebSocketRoute.config

```ts
override readonly config?: RouteConfig<never, never, never, WebSocketRoute<string>> | undefined
```

No schemas apply: an upgrade request carries no body, search or params to validate.

### WebSocketRoute.handler

```ts
override readonly handler: ContextHandler<never, never, never, WebSocketRoute<string>>
```

Returns the route itself, which [`App.composeRoutes`](../App/index.md#app-composeroutes) attaches to the
socket as its data — that is how a message arriving minutes later finds its
way back to [`WebSocketRoute.onMessage`](#websocketroute-onmessage).

The upgrade itself still happens in `App`; this handler only supplies
what the socket carries.

**Returns** — This route.

### WebSocketRoute.onOpen

```ts
onOpen?: WebSocketOnOpen | undefined
```

Called once per connection, after the upgrade succeeds.

### WebSocketRoute.onClose

```ts
onClose?: WebSocketOnClose | undefined
```

Called once per connection, when it closes.

### WebSocketRoute.onMessage

```ts
onMessage!: WebSocketOnMessage
```

Called for every message received.

## WebSocketOnMessage

_type_

```ts
type WebSocketOnMessage = (ws: ServerWebSocket, message: string | Buffer) => MaybePromise<void>;
```

Runs for each message a client sends.

**Parameters**

- `ws` — The [`ServerWebSocket`](../Server/index.md#serverwebsocket) the message arrived on.
- `message` — The payload: a string for text frames, a `Buffer` for binary ones.

## WebSocketOnClose

_type_

```ts
type WebSocketOnClose = (ws: ServerWebSocket, code?: number, reason?: string) => MaybePromise<void>;
```

Runs when a connection closes, whichever side ended it.

**Parameters**

- `ws` — The closing [`ServerWebSocket`](../Server/index.md#serverwebsocket).
- `code` — The WebSocket close code, when one was sent.
- `reason` — The accompanying reason, when one was sent.

## WebSocketOnOpen

_type_

```ts
type WebSocketOnOpen = (ws: ServerWebSocket) => MaybePromise<void>;
```

Runs once a connection has been upgraded and is ready.

**Parameters**

- `ws` — The newly opened [`ServerWebSocket`](../Server/index.md#serverwebsocket).

## WebSocketRouteDefinition

_interface_

```ts
interface WebSocketRouteDefinition
```

The socket lifecycle callbacks a `WebSocketRoute` is built from.

| Name        | Description                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `onOpen`    | Called once per connection, after the upgrade succeeds.                                                      |
| `onClose`   | Called once per connection, when it closes.                                                                  |
| `onMessage` | Called for every message received. The only required callback — a socket that never reads has nothing to do. |

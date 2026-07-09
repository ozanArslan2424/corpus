# WebSocketRoute

The `WebSocketRoute` class defines a WebSocket endpoint with automatic registration to the global router. It accepts a path and a callbacks object containing lifecycle handlers for connection open, close, and message events. This class doesn't really do much. It's just a thin wrapper on top of Bun's websocket implementation to register it to the router. Read more here: [Bun Docs](https://bun.com/docs/runtime/http/websockets).

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)

</section>

## Usage

Routes can be instantiated directly with `new`. The constructor automatically registers the route to the global router store.

### Simple WebSocket echo

```ts
import { C } from "@ozanarslan/corpus";

// GET /ws upgrades to WebSocket
new C.WebSocketRoute("/ws", {
	onMessage: (ws, message) => {
		ws.send(`Echo: ${message}`);
	},
});
```

### Full lifecycle handlers

```ts
import { C } from "@ozanarslan/corpus";

new C.WebSocketRoute("/chat", {
	onOpen: (ws) => {
		console.log("Client connected");
		ws.send("Welcome!");
	},
	onMessage: (ws, message) => {
		broadcast(message);
	},
	onClose: (ws, code, reason) => {
		console.log(`Client disconnected: ${code} ${reason}`);
	},
});
```

### Binary message handling

```ts
import { C } from "@ozanarslan/corpus";

new C.WebSocketRoute("/binary", {
	onMessage: (ws, message) => {
		if (message instanceof Buffer) {
			ws.send(message); // echo binary
		}
	},
});
```

### Extending the abstract class

It makes sense to extend the abstract class since the callbacks object involves 3 callbacks and can become pretty ugly.

```ts
class MyRoute extends C.WebSocketRouteAbstract {
	constructor() {
		super();
		// this method needs to be called to register it to the router
		// here or where you instantiate
		this.register();
	}

	override endpoint: string = "/ws";
	readonly onOpen?: WebSocketOnOpen | undefined = undefined;
	readonly onClose?: WebSocketOnClose | undefined = undefined;
	readonly onMessage: WebSocketOnMessage = (ws, message) => {
		ws.send(`ECHO: ${message}`);
	};
}
```

> Note: since this wraps Bun's pub/sub, published messages are not delivered back to the sender. If the sender should also receive the message, send it to the sender explicitly.

## Constructor Parameters

### path

`E extends string`

The URL endpoint path. Always uses `GET` method (WebSocket upgrade handshake).

### callbacks

`WebSocketRouteCallbacks`

The WebSocket lifecycle definition object. `ws` is Bun's `ServerWebSocket`.

```ts
type WebSocketOnOpen = Func<[ws: ServerWebSocket], MaybePromise<void>>;
type WebSocketOnClose = Func<
	[ws: ServerWebSocket, code?: number, reason?: string],
	MaybePromise<void>
>;
type WebSocketOnMessage = Func<[ws: ServerWebSocket, message: string | Buffer], MaybePromise<void>>;

type WebSocketRouteCallbacks = {
	onOpen?: WebSocketOnOpen;
	onClose?: WebSocketOnClose;
	onMessage: WebSocketOnMessage;
};
```

| Handler     | Required | Description                                                                                                             |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `onMessage` | Yes      | Called when a message is received from the client. `message` is `string` for text frames or `Buffer` for binary frames. |
| `onOpen`    | No       | Called when the WebSocket connection is established.                                                                    |
| `onClose`   | No       | Called when the connection closes. Receives close code and reason string.                                               |

## Properties

All constructor options are stored as readonly properties:

| Property    | Type                     | Description                                                          |
| ----------- | ------------------------ | -------------------------------------------------------------------- |
| `id`        | `string`                 | Unique route identifier (`{METHOD} {endpoint}`, e.g. `GET /ws`)      |
| `method`    | `Method`                 | Fixed to `Method.GET` (WebSocket upgrade)                            |
| `endpoint`  | `E`                      | Resolved path                                                        |
| `handler`   | `Func`                   | Getter returning `() => this` so the router can resolve the instance |
| `model`     | `undefined`              | Not applicable for WebSocket routes                                  |
| `variant`   | `RouteVariant.websocket` | Fixed to `websocket` for this class                                  |
| `onOpen`    | `Func \| undefined`      | Connection open handler                                              |
| `onClose`   | `Func \| undefined`      | Connection close handler                                             |
| `onMessage` | `Func`                   | Message receive handler (required)                                   |

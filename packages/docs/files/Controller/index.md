# Controller

Grouping for routes that share a path prefix and a common preamble.

A `Controller` is a thin factory: each method constructs the
corresponding `RouteBase` subclass with the prefix already joined on,
records its id, and returns it. The routes are ordinary routes registered on
the nearest `App` exactly as if they had been constructed directly —
a controller adds no dispatch layer of its own.

```ts
import { Controller } from "@ozanarslan/corpus";

const users = new Controller("/users");
users.beforeEach = (c) => authenticate(c);

users.route("GET /:id", (c) => findUser(c.params.id));
```

## Controller

_class_

```ts
class Controller<Px extends Optional<string>= Optional<string>>
```

Registers routes under a shared path prefix.

Every method mirrors the constructor of the route class it creates, so moving
a route into a controller means changing the call site and nothing else. The
prefix is folded into the endpoint at construction time and into the endpoint
_type_ through `WithPrefix`, so the returned route stays as narrowly
typed as one written out by hand.

[`Controller.beforeEach`](#controller-beforeeach) runs ahead of the handler for the route kinds
that have a user-supplied handler — [`Controller.route`](#controller-route) and
[`Controller.staticRoute`](#controller-staticroute). The other kinds resolve their responses
internally and are unaffected.

[`Controller.routeIds`](#controller-routeids) makes the group addressable afterwards, which is
how a `Middleware` can be attached to every route in a controller at
once.

**Type parameters**

- `Px` — The literal prefix type, carried into every endpoint type the controller produces.

### Controller.constructor()

```ts
constructor(public prefix?: Px)
```

Creates a controller.

**Parameters**

- `prefix` — Path segment prepended to every endpoint registered through this controller. Omit it to group routes without changing their paths — the shared [`Controller.beforeEach`](#controller-beforeeach) and [`Controller.routeIds`](#controller-routeids) still apply.

### Controller.routeIds

```ts
readonly routeIds: Set<string>
```

Ids of every `RouteBase` registered through this controller, in the
order they were created.

Pass them to a `Middleware` to target the whole group:

```ts
new Middleware([...users.routeIds], handler);
```

### Controller.beforeEach

```ts
beforeEach?: ContextHandler
```

Runs before the handler of every [`Controller.route`](#controller-route) and
[`Controller.staticRoute`](#controller-staticroute) created by this controller.

Its return value is discarded — this is for side effects on the
`Context`, such as authenticating a request or populating
[`Context.data`](../Context/index.md#context-data). Throwing here aborts the request before the handler
runs, which is the intended way to reject one.

Assign it before registering routes: each route captures the controller, not
the function, but a route registered while it is unset still checks it at
request time. For behaviour that must wrap the response as well as precede
it, use a `Middleware` targeting [`Controller.routeIds`](#controller-routeids) instead.

### Controller.route()

```ts
route<B = unknown, S = unknown, P = unknown, R = unknown, E extends string = string>(...args: ConstructorParameters<typeof Route<B, S, P, R, E>>): Route<B, S, P, R, WithPrefix<Px, E>>
```

Registers a dynamic route under this controller. Behaves identically to `Route`
but automatically prepends the controller prefix and runs `beforeEach` before the handler.

**Type parameters**

- `B` — Parsed [`Context.body`](../Context/index.md#context-body) type.
- `S` — Parsed [`Context.search`](../Context/index.md#context-search) type.
- `P` — Parsed [`Context.params`](../Context/index.md#context-params) type.
- `R` — Response body type.
- `E` — The endpoint literal, before the prefix is applied.

**Parameters**

- `args` — The `Route` constructor arguments: the route address (a `"METHOD /endpoint"` string or a method/endpoint pair), the [`ContextHandler`](../Context/index.md#contexthandler), and an optional [`RouteConfig`](../RouteBase/index.md#routeconfig).

**Returns** — The registered `Route`, its endpoint type prefixed.

### Controller.staticRoute()

```ts
staticRoute<B = unknown, S = unknown, P = unknown, E extends string = string>(...args: ConstructorParameters<typeof StaticRoute<B, S, P, E>>): StaticRoute<B, S, P, WithPrefix<Px, E>>
```

Registers a static route under this controller. Behaves identically to `StaticRoute`
but automatically prepends the controller prefix.

[`Controller.beforeEach`](#controller-beforeeach) runs only when a callback is supplied, since
that is where the controller has a handler to wrap; a static route that just
serves its file is left alone.

**Type parameters**

- `B` — Parsed [`Context.body`](../Context/index.md#context-body) type.
- `S` — Parsed [`Context.search`](../Context/index.md#context-search) type.
- `P` — Parsed [`Context.params`](../Context/index.md#context-params) type.
- `E` — The endpoint literal, before the prefix is applied.

**Parameters**

- `args` — The `StaticRoute` constructor arguments: the route address, the file path, an optional callback receiving the `Context` and the file contents, and an optional [`RouteConfig`](../RouteBase/index.md#routeconfig).

**Returns** — The registered `StaticRoute`, its endpoint type prefixed.

### Controller.fileRoute()

```ts
fileRoute<E extends string = string>(...args: ConstructorParameters<typeof FileRoute<E>>): FileRoute<WithPrefix<Px, E>>
```

Registers a file route under this controller. Behaves identically to `FileRoute`
but automatically prepends the controller prefix.

[`Controller.beforeEach`](#controller-beforeeach) does not apply: a file route resolves its
response internally and takes no handler to wrap.

**Type parameters**

- `E` — The endpoint literal, before the prefix is applied.

**Parameters**

- `args` — The `FileRoute` constructor arguments: the route address and the file definition.

**Returns** — The registered `FileRoute`, its endpoint type prefixed.

### Controller.websocketRoute()

```ts
websocketRoute<E extends string = string>(...args: ConstructorParameters<typeof WebSocketRoute<E>>): WebSocketRoute<WithPrefix<Px, E>>
```

Registers a websocket route under this controller. Behaves identically to `WebSocketRoute`
but automatically prepends the controller prefix.

The address is a plain endpoint rather than a method-and-endpoint pair, since
an upgrade is always a [`Method.GET`](../Request/index.md#method-get).
[`Controller.beforeEach`](#controller-beforeeach) does not apply — the socket lifecycle
callbacks are not a [`ContextHandler`](../Context/index.md#contexthandler).

**Type parameters**

- `E` — The endpoint literal, before the prefix is applied.

**Parameters**

- `args` — The `WebSocketRoute` constructor arguments: the endpoint followed by the socket lifecycle callbacks.

**Returns** — The registered `WebSocketRoute`, its endpoint type prefixed.

### Controller.bundleRoute()

```ts
bundleRoute<E extends string = string>(...args: ConstructorParameters<typeof BundleRoute<E>>): BundleRoute<WithPrefix<Px, E>>
```

Registers a bundle route under this controller. Behaves identically to `BundleRoute`
but automatically prepends the controller prefix.

[`Controller.beforeEach`](#controller-beforeeach) does not apply: a bundle route resolves files
internally and takes no handler to wrap.

**Type parameters**

- `E` — The endpoint literal, before the prefix is applied.

**Parameters**

- `args` — The `BundleRoute` constructor arguments: the endpoint, the directory to serve, and an optional `BundleRouteDefinition`.

**Returns** — The registered `BundleRoute`, its endpoint type prefixed.

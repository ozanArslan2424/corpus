# App

The application root: owns the `Server`, the route table, the
`Middleware` registry, and the request lifecycle that ties them
together.

An `App` is the only thing that talks to Bun's HTTP server.
`RouteBase` implementations and `Middleware` instances register
themselves against an app, and at [`App.listen`](#app-listen) time the app compiles
them into a single [`ServerRouteMap`](../Server/index.md##ServerRouteMap) plus a fallback [`ServerHandler`](../Server/index.md#serverhandler).

```ts
const app = new App({ port: 3000, prefix: "/api" });
await app.listen();
```

## App

_class_

```ts
class App implements AppInterface
```

An HTTP application.

The app is a container first: `RouteBase` implementations and
`Middleware` instances attach to it as they are constructed. Nothing is
compiled until [`App.listen`](#app-listen), at which point [`App.composeRoutes`](#app-composeroutes)
turns routes into a [`ServerRouteMap`](../Server/index.md#serverroutemap) and folds the matching
`Middleware` handlers into each route's chain.

Every request follows the same path — build a `Context`, resolve
[`Context.params`](../Context/index.md#context-params), [`Context.search`](../Context/index.md#context-search) and [`Context.body`](../Context/index.md#context-body)
through the parsers registry, run the `composeHandlerChain` chain, apply
[`CorsInterface`](../Cors/index.md#corsinterface), and serialise the `Res`. Anything thrown along
the way is routed to [`App.handleError`](#app-handleerror).

Constructing an app calls [`registerApp`](../AppsRegistry/index.md#registerapp), so it is discoverable without
being passed around.

### App.constructor()

```ts
constructor(opts?: AppOptions)
```

Creates an app and registers it globally with [`registerApp`](../AppsRegistry/index.md#registerapp).

**Parameters**

- `opts` — `AppOptions` overriding port, hostname, prefix, idle timeout, `TlsOptions` and body size. Any field left out keeps the default declared on the corresponding `App` property.

### App.server

```ts
server: Nullable<Server>;
```

The live `Server`. `null` until [`App.listen`](#app-listen) is called and again
after [`App.close`](#app-close).

### App.cors

```ts
cors: Optional<CorsInterface>;
```

[`CorsInterface`](../Cors/index.md#corsinterface) policy for this app. When set,
[`CorsInterface.handler`](../Cors/index.md#corsinterface-handler) runs after every handler chain in
[`App.respond`](#app-respond) and [`CorsInterface.handlePreflight`](../Cors/index.md#corsinterface-handlepreflight) answers
preflight requests. Left unset, [`App.handlePreflight`](#app-handlepreflight) replies with
[`Status.NO_CONTENT`](../Res/index.md#status-no-content) and no CORS headers are added.

### App.routes

```ts
routes: Array<RouteBase>;
```

`RouteBase` instances attached to this app, in registration order.

### App.middlewares

```ts
middlewares: Map<string, Array<Middleware>>;
```

`Middleware` instances indexed by the [`RouteBase.id`](../RouteBase/index.md#routebase-id) they
target. The `"*"` key holds middlewares that run on every route as well as
on the [`App.handleNotFound`](#app-handlenotfound) path.

### App.port

```ts
port: number;
```

Port the `Server` binds to. Defaults to `3000`.

### App.prefix

```ts
prefix: string;
```

Prefix prepended to every `RouteBase` endpoint on this app. Defaults to `""`.

### App.hostname

```ts
hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
```

Interface the `Server` binds to. Defaults to `"0.0.0.0"`.

### App.idleTimeout

```ts
idleTimeout?: number
```

Seconds an idle connection is kept open before Bun closes it.

### App.tls

```ts
tls?: TlsOptions
```

`TlsOptions` material. When present the app is served over HTTPS.

### App.maxRequestBodySize

```ts
maxRequestBodySize?: number
```

App-wide body ceiling in bytes passed to Bun. A `RouteBase` may
declare a tighter limit in its `Config`, enforced per request by
`enforceBodyLimit`.

### App.baseUrl

```ts
get baseUrl(): string
```

Origin the app is reachable at, for example `http://0.0.0.0:3000`.

**Returns** — The `Server` URL once listening; otherwise a URL derived from [`App.tls`](#app-tls), [`App.hostname`](#app-hostname) and [`App.port`](#app-port).

### App.createServer()

```ts
protected createServer(): Server
```

Compiles [`App.composeRoutes`](#app-composeroutes) and [`App.composeFetch`](#app-composefetch) and hands
them to `Bun.serve`, wiring the WebSocket callbacks through to the handlers
carried by each `WebSocketRoute`. Unroutable middlewares are reported
first by [`App.warnUnmatchedMiddlewares`](#app-warnunmatchedmiddlewares).

Calling this when [`App.server`](#app-server) already exists is a no-op that returns
the existing one, so it is safe to reach for lazily.

**Returns** — The running `Server`.

### App.listen()

```ts
async listen(): Promise<void>
```

Starts the app.

Installs `SIGINT` and `SIGTERM` handlers that call [`App.close`](#app-close), runs
[`App.handleBeforeListen`](#app-handlebeforelisten), then compiles and starts the `Server`
via [`App.createServer`](#app-createserver). A failure at any of these steps is logged and
the app is closed rather than left half-started.

**Returns** — A promise that resolves once the `Server` is listening.

### App.close()

```ts
async close(closeActiveConnections: boolean = true): Promise<void>
```

Stops the app.

Runs [`App.handleBeforeClose`](#app-handlebeforeclose), stops the `Server`, and clears
[`App.server`](#app-server). Outside the `test` value of [`Config.nodeEnv`](../Config/index.md#config-nodeenv) this
also exits the process, so tests can close apps without tearing down the
runner.

**Parameters**

- `closeActiveConnections` — Whether in-flight connections are severed immediately rather than allowed to drain. Defaults to `true`.

**Returns** — A promise that resolves once the `Server` has stopped.

### App.composeRoutes()

```ts
protected composeRoutes(): ServerRouteMap
```

Compiles [`App.routes`](#app-routes) into the [`ServerRouteMap`](../Server/index.md#serverroutemap) Bun expects,
keyed by endpoint and then by [`Method`](../Request/index.md#method).

Each entry is a full request pipeline wrapped in [`App.finalize`](#app-finalize):
wildcard segments are lifted into `Req.params` (Bun does not treat
them as params), then params, search and body are parsed and validated
against the `RouteBase` `Config` — but only the ones the handler
chain actually reads, as reported by [`getContextAccess`](../ContextAccess/index.md#getcontextaccess). Routes with
[`RouteVariant.websocket`](../RouteBase/index.md#routevariant-websocket) upgrade the connection into a
`WebSocketRoute` instead of responding, and [`Method.GET`](../Request/index.md#method-get) and
[`Method.HEAD`](../Request/index.md#method-head) skip body work entirely.

**Returns** — A [`ServerRouteMap`](../Server/index.md#serverroutemap) ready to hand to `Bun.serve`.

**Throws** — `Exception` with [`Status.UPGRADE_REQUIRED`](../Res/index.md#status-upgrade-required) when a WebSocket upgrade is rejected.

### App.composeFetch()

```ts
protected composeFetch(): ServerHandler
```

Builds the [`ServerHandler`](../Server/index.md#serverhandler) Bun uses for requests that matched no
`RouteBase`.

Preflight requests — [`Method.OPTIONS`](../Request/index.md#method-options) carrying
[`HeaderKey.AccessControlRequestMethod`](../Headers/index.md#headerkey-accesscontrolrequestmethod) — go to
[`App.handlePreflight`](#app-handlepreflight). Everything else runs the global (`"*"`)
`Middleware` chain followed by [`App.handleNotFound`](#app-handlenotfound), so global
middlewares still observe traffic to unknown endpoints.

**Returns** — The `fetch` handler for `Bun.serve`, wrapped by [`App.finalize`](#app-finalize).

### App.finalize()

```ts
protected finalize(handler: ContextHandler): ServerHandler
```

Wraps a [`ContextHandler`](../Context/index.md#contexthandler) into the [`ServerHandler`](../Server/index.md#serverhandler) Bun calls,
giving it a `Context` from [`App.contextFactory`](#app-contextfactory) and guaranteeing
that every outcome — value or throw — leaves as a `Response`.

This is the single boundary where errors are caught, so every throw reaches
[`App.handleError`](#app-handleerror) through [`App.respondWithError`](#app-respondwitherror).

**Parameters**

- `handler` — The [`ContextHandler`](../Context/index.md#contexthandler) to run for the request.

**Returns** — A [`ServerHandler`](../Server/index.md#serverhandler) suitable for a [`ServerRouteMap`](../Server/index.md#serverroutemap) entry or for `Bun.serve`'s `fetch`.

### App.respond()

```ts
protected async respond(context: Context, result: unknown): Promise<Response>
```

Turns a handler's return value into the response sent over the wire.

A returned `Res` replaces [`Context.res`](../Context/index.md#context-res) wholesale; any other
defined value becomes [`Res.body`](../Res/index.md#res-body); `undefined` leaves the existing
`Res` untouched, which is how handlers that mutate
[`Context.res`](../Context/index.md#context-res) directly are supported. [`CorsInterface.handler`](../Cors/index.md#corsinterface-handler)
runs last and separately from the `Middleware` chain, so CORS headers
cannot be clobbered by a short-circuiting middleware.

**Parameters**

- `context` — The `Context` for the request.
- `result` — Whatever the handler chain returned.

**Returns** — The native `Response` produced by [`Res.toNativeResponse`](../Res/index.md#res-tonativeresponse).

### App.respondWithError()

```ts
protected async respondWithError(context: Context, err: Error): Promise<Response>
```

Runs [`App.handleError`](#app-handleerror) and responds with its result.

If the error handler itself throws, that second failure is logged and a bare
[`Status.INTERNAL_SERVER_ERROR`](../Res/index.md#status-internal-server-error) is returned — the request never escapes
without a response.

**Parameters**

- `context` — The `Context` the failure occurred in.
- `err` — The `Error` thrown by the handler chain.

**Returns** — The error response.

### App.handleBeforeListen

```ts
handleBeforeListen: Optional<() => MaybePromise<void>>;
```

Hook run inside [`App.listen`](#app-listen), before the `Server` is created.
Use it for setup that must complete before traffic is accepted; throwing
here aborts startup and closes the app.

### App.handleBeforeClose

```ts
handleBeforeClose: Optional<() => MaybePromise<void>>;
```

Hook run inside [`App.close`](#app-close), before the `Server` is stopped. Use
it to release resources the app owns.

### App.handleError

```ts
handleError: ErrorHandler;
```

Default `ErrorHandler`. An `Exception` is rendered through
[`Exception.toRes`](../Exception/index.md#exception-tores); anything else becomes an opaque
[`Status.INTERNAL_SERVER_ERROR`](../Res/index.md#status-internal-server-error) `Res`, so internal failures never
leak their message. Replace it to customise error output.

**Parameters**

- `err` — The thrown `Error`.

**Returns** — The `Res` to send.

### App.handleNotFound

```ts
handleNotFound: ContextHandler;
```

Default [`ContextHandler`](../Context/index.md#contexthandler) for unmatched requests. Replace it to
customise the 404 body.

**Parameters**

- `c` — The `Context` for the unmatched request.

**Returns** — A [`Status.NOT_FOUND`](../Res/index.md#status-not-found) `Res` naming the method and URL that did not resolve.

### App.handlePreflight

```ts
handlePreflight: ContextHandler;
```

Default [`ContextHandler`](../Context/index.md#contexthandler) for CORS preflight requests. Delegates to
[`CorsInterface.handlePreflight`](../Cors/index.md#corsinterface-handlepreflight) when [`App.cors`](#app-cors) is configured.

**Parameters**

- `c` — The `Context` for the preflight request.

**Returns** — The CORS preflight response, or an empty [`Status.NO_CONTENT`](../Res/index.md#status-no-content) `Res` when no [`CorsInterface`](../Cors/index.md#corsinterface) is set.

### App.contextFactory

```ts
contextFactory: ContextFactory;
```

Default [`ContextFactory`](../Context/index.md#contextfactory). Replace it to have the app build a
`Context` subclass carrying your own per-request state.

**Parameters**

- `request` — The incoming request.
- `server` — The `Server` that accepted it.

**Returns** — A new `Context`.

### App.addMiddleware()

```ts
addMiddleware(middleware: Middleware): void
```

Registers a `Middleware` under every [`RouteBase.id`](../RouteBase/index.md#routebase-id) in
[`Middleware.routeIds`](../Middleware/index.md#middleware-routeids), so one instance can serve several routes.

**Parameters**

- `middleware` — The `Middleware` to register.

### App.findMiddlewares()

```ts
findMiddlewares(routeId: string): Array<Middleware>
```

Resolves the `Middleware` instances that apply to a route, global ones
first so they wrap the route-specific ones.

**Parameters**

- `routeId` — The [`RouteBase.id`](../RouteBase/index.md#routebase-id) to resolve for, or `"*"` to get only the global middlewares without duplicating them.

**Returns** — The middlewares in execution order.

### App.warnUnmatchedMiddlewares()

```ts
protected warnUnmatchedMiddlewares(): void
```

Logs a warning for every `Middleware` whose target
[`RouteBase.id`](../RouteBase/index.md#routebase-id) is not registered on this app and which therefore can
never run — usually a typo or a route that was never attached.

Runs from [`App.createServer`](#app-createserver) rather than [`App.addMiddleware`](#app-addmiddleware),
because registration order is not guaranteed and a middleware may legally be
added before its route.

## AppInterface

_interface_

```ts
interface AppInterface
```

The public shape of an application instance, implemented by `App`.

Depend on this type rather than the `App` class when you need to accept
an app without pinning the implementation.

### AppInterface.server

```ts
server: Nullable<Server>;
```

The running `Server`, or `null` before [`AppInterface.listen`](#appinterface-listen) and after [`AppInterface.close`](#appinterface-close).

### AppInterface.cors

```ts
cors: Optional<CorsInterface>;
```

[`CorsInterface`](../Cors/index.md#corsinterface) policy applied to every response and to preflight requests.

### AppInterface.routes

```ts
routes: Array<RouteBase>;
```

`RouteBase` instances registered on this app, in registration order.

### AppInterface.middlewares

```ts
middlewares: Map<string, Array<Middleware>>;
```

`Middleware` instances keyed by the [`RouteBase.id`](../RouteBase/index.md#routebase-id) they target; `"*"` holds the global ones.

### AppInterface.port

```ts
port: number;
```

TCP port to bind.

### AppInterface.prefix

```ts
prefix: string;
```

Path prefix prepended to every `RouteBase` endpoint on this app.

### AppInterface.hostname

```ts
hostname: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">;
```

Interface to bind.

### AppInterface.idleTimeout

```ts
idleTimeout?: number
```

Seconds a connection may stay idle before Bun closes it.

### AppInterface.tls

```ts
tls?: TlsOptions
```

`TlsOptions` material; when set, the app is served over HTTPS.

### AppInterface.baseUrl

```ts
get baseUrl(): string;
```

Origin the app is reachable at.

### AppInterface.listen()

```ts
listen(): Promise<void>
```

Compiles `RouteBase` and `Middleware` registrations and starts the `Server`.

### AppInterface.close()

```ts
close(closeActiveConnections?: boolean): Promise<void>
```

Stops the `Server` and releases the port.

### AppInterface.handleBeforeListen

```ts
handleBeforeListen: Optional<() => MaybePromise<void>>;
```

Hook run just before the `Server` starts.

### AppInterface.handleBeforeClose

```ts
handleBeforeClose: Optional<() => MaybePromise<void>>;
```

Hook run just before the `Server` stops.

### AppInterface.handleError

```ts
handleError: ErrorHandler;
```

`ErrorHandler` that converts a thrown `Error` into a response value.

### AppInterface.handleNotFound

```ts
handleNotFound: ContextHandler;
```

[`ContextHandler`](../Context/index.md#contexthandler) that produces the response for requests matching no `RouteBase`.

### AppInterface.handlePreflight

```ts
handlePreflight: ContextHandler;
```

[`ContextHandler`](../Context/index.md#contexthandler) that produces the response for CORS preflight requests.

### AppInterface.contextFactory

```ts
contextFactory: ContextFactory;
```

[`ContextFactory`](../Context/index.md#contextfactory) that builds the `Context` for each incoming request.

### AppInterface.addMiddleware()

```ts
addMiddleware(middleware: Middleware): void
```

Registers a `Middleware` against each [`RouteBase.id`](../RouteBase/index.md#routebase-id) it targets.

### AppInterface.findMiddlewares()

```ts
findMiddlewares(routeId: string): Array<Middleware>
```

Resolves the `Middleware` instances that apply to a [`RouteBase.id`](../RouteBase/index.md#routebase-id).

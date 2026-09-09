# Context

The per-request object every handler receives.

A `Context` carries the incoming request alongside the parsed views of
it — [Context.body](#context-body), [Context.params](#context-params), [Context.search](#context-search) —
and the `Res` being built up in reply. It is created once per request by
the [ContextFactory](#contextfactory) on [App.contextFactory](../App/index.md#app-contextfactory) and threaded through
the whole `Middleware` chain, so it is also the place to hang state that
one handler produces and another consumes.

The parsed fields start out empty and are filled by `App` during the
request lifecycle, but only for the surfaces a route's handlers actually read
— [getContextAccess](./ContextAccess/index.md#getcontextaccess) decides that, so an untouched body is never parsed.

<section class="table-of-contents">

##### Contents

1. [Context](#context)
2. [ContextDataInterface](#contextdatainterface)
3. [ContextFactory](#contextfactory)
4. [ContextHandler](#contexthandler)

</section>

## Context

_class_

```ts
class Context<B = unknown, S = unknown, P = unknown, R = unknown>
```

Everything a handler needs to know about one request, and everything it uses
to answer it.

The type parameters are supplied by the route the context belongs to, so a
handler sees its own validated shapes rather than `unknown`.

[Context.res](#context-res) and [Context.url](#context-url) are lazy: neither the response
object nor the parsed URL is constructed until something reads it, so a
handler that returns a body without touching either pays for neither.

The parsed containers are created with `createSafeObject`, so a payload
carrying a `__proto__` key cannot reach `Object.prototype` through them.

**Type parameters**

- `B` — Parsed [Context.body](#context-body) type.
- `S` — Parsed [Context.search](#context-search) type.
- `P` — Parsed [Context.params](#context-params) type.
- `R` — Response body type carried by [Context.res](#context-res).

### Context.constructor()

```ts
constructor(req: Request, server: Maybe<Server>)
```

Creates a context with empty parsed containers; `App` fills them
during the request lifecycle.

**Parameters**

- `req` — The incoming request.
- `server` — The `Server` that accepted it. Absent when the request was dispatched without one, which is why [Context.server](#context-server) is optional at every use site — including the WebSocket upgrade.

### Context.body

```ts
body: B;
```

The parsed request body, decoded by `BodyParser` and validated against
the route's [RouteConfig](../RouteBase/index.md#routeconfig) body schema.

Empty for [Method.GET](../Request/index.md#method-get) and [Method.HEAD](../Request/index.md#method-head) requests, and for any
route whose handlers never read it.

### Context.params

```ts
params: P;
```

The path parameters matched by the route, parsed by
[ParsersRegistry.urlParamsParser](../Globals/ParsersRegistry/index.md#parsersregistry-urlparamsparser) and validated against the route's
params schema. A wildcard segment is available under the `*` key.

### Context.search

```ts
search: S;
```

The query string, parsed by [ParsersRegistry.searchParamsParser](../Globals/ParsersRegistry/index.md#parsersregistry-searchparamsparser) and
validated against the route's search schema. Empty when the request carried
no query string.

### Context.data

```ts
data: ContextDataInterface;
```

Free-form request-scoped state, shared across the whole
`Middleware` chain and the route handler. This is how a middleware
hands something — an authenticated user, a request id — to what runs after
it. Type it by augmenting [ContextDataInterface](#contextdatainterface).

### Context.server

```ts
readonly server: Maybe<Server>
```

The `Server` that accepted the request. Needed to upgrade a connection
to a `WebSocketRoute`; absent when the request was dispatched without
a server.

### Context.req

```ts
readonly req: Request
```

The untouched incoming request. Read it for headers and for the raw body;
the parsed views live on [Context.body](#context-body) and its siblings.

### Context.res

```ts
get res(): Res<R>
set res(value: Res<R>)
```

The response under construction. Mutate it to set status, headers or body
before returning, or assign a whole new `Res` to replace it.

A `Middleware` that replaces this after `next()` resolves wins over
whatever the downstream handler returned — see `composeHandlerChain`.

**Returns** — The response object, created on first access.

### Context.url

```ts
get url(): URL
```

The request URL, parsed once and reused.

**Returns** — The parsed `URL`. Prefer [Context.params](#context-params) and [Context.search](#context-search) for path and query values; reach for this when you need the pathname or origin itself, as `BundleRoute` does.

## ContextDataInterface

_interface_

```ts
interface ContextDataInterface
```

Declaration target for [Context.data](#context-data), the request-scoped state shared
between `Middleware` and route handlers.

Empty by design. Augment it from your own code so everything a middleware sets
is typed where a handler reads it:

```ts
declare module "@ozanarslan/corpus" {
	interface ContextDataInterface {
		user: User;
	}
}
```

## ContextFactory

_type_

```ts
type ContextFactory<B = unknown, S = unknown, P = unknown, R = unknown> = (
	request: Request,
	server: Maybe<Server>,
) => Context<B, S, P, R>;
```

Builds the `Context` for an incoming request. Assigned to
[App.contextFactory](../App/index.md#app-contextfactory); replace it to have an app construct a
`Context` subclass.

**Type parameters**

- `B` — Parsed [Context.body](#context-body) type.
- `S` — Parsed [Context.search](#context-search) type.
- `P` — Parsed [Context.params](#context-params) type.
- `R` — Response body type carried by [Context.res](#context-res).

**Parameters**

- `request` — The incoming request.
- `server` — The `Server` that accepted it, absent when the request was dispatched without one.

**Returns** — The context the request will be handled with.

## ContextHandler

_type_

```ts
type ContextHandler<B = unknown, S = unknown, P = unknown, R = unknown> = (
	context: Context<B, S, P, R>,
) => MaybePromise<R>;
```

A function that handles a request given its `Context`. This is the shape
of a `RouteBase` handler and of the app-level hooks
[App.handleNotFound](../App/index.md#app-handlenotfound) and [App.handlePreflight](../App/index.md#app-handlepreflight).

A `Middleware` handler is a [MiddlewareHandler](../Middleware/index.md#middlewarehandler) instead, since it
additionally receives `next`.

**Type parameters**

- `B` — Parsed [Context.body](#context-body) type.
- `S` — Parsed [Context.search](#context-search) type.
- `P` — Parsed [Context.params](#context-params) type.
- `R` — Response body type.

**Parameters**

- `context` — The `Context` for the request.

**Returns** — The response body, a `Res`, or a promise of either. Returning `undefined` leaves [Context.res](#context-res) as the handler mutated it.

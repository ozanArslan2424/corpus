# Route

The ordinary route: a method, an endpoint, and a handler.

`Route` is the [`RouteVariant.dynamic`](../RouteBase/index.md#routevariant-dynamic) member of the
`RouteBase` family and the one most code uses. The others exist for
responses the framework can produce itself — files, directories, socket
upgrades — while this one just runs your function.

```ts
import { Route } from "@ozanarslan/corpus";

new Route("GET /users/:id", (c) => findUser(c.params.id));
```

A [`RouteConfig`](../RouteBase/index.md#routeconfig) adds schemas for the body, search and params, which both
validate the request and type `Context`, so `c.params.id` is known to be
whatever the schema says it is.

## Route

_class_

```ts
class Route<B = unknown, S = unknown, P = unknown, R = unknown, E extends string = string, >extends RouteBase<B, S, P, R, E>
```

A route handled by a function.

Constructing one registers it on the nearest `App`, which compiles it
into the server's route map at [`App.listen`](../App/index.md#app-listen) time along with whatever
`Middleware` targets it.

The type parameters are usually inferred from the [`RouteConfig`](../RouteBase/index.md#routeconfig) rather
than written out, and flow into the `Context` the handler receives.

**Type parameters**

- `B` — Parsed [`Context.body`](../Context/index.md#context-body) type.
- `S` — Parsed [`Context.search`](../Context/index.md#context-search) type.
- `P` — Parsed [`Context.params`](../Context/index.md#context-params) type.
- `R` — Response body type.
- `E` — The literal endpoint type, carried so the endpoint stays narrowly typed at the call site.

### Route.constructor()

```ts
constructor();
constructor(address: RouteAddress<E>, callback: ContextHandler<B, S, P, R>, model?: RouteConfig<B, S, P, R>, );
constructor(address?: RouteAddress<E>, callback?: ContextHandler<B, S, P, R>, model?: RouteConfig<B, S, P, R>, )
```

Creates a route for subclasses, which declare
[`Route.method`](#route-method), [`Route.endpoint`](#route-endpoint) and [`Route.handler`](#route-handler) as
class fields and call [`RouteBase.register`](../RouteBase/index.md#routebase-register) themselves.

Creates a route and registers it on the nearest `App`.

**Parameters**

- `address` — The [`RouteAddress`](../RouteBase/index.md#routeaddress): a `"METHOD /endpoint"` string or a method-and-endpoint pair.
- `callback` — The [`ContextHandler`](../Context/index.md#contexthandler) that answers the request.
- `model` — Optional [`RouteConfig`](../RouteBase/index.md#routeconfig) declaring validation schemas and per-route limits. Its schemas also type the `Context` the handler receives.

### Route.variant

```ts
readonly variant: RouteVariant
```

Marks this route as [`RouteVariant.dynamic`](../RouteBase/index.md#routevariant-dynamic) for `App` route compilation.

### Route.method

```ts
readonly method!: Method
```

The [`Method`](../Request/index.md#method) this route answers, taken from the [`RouteAddress`](../RouteBase/index.md#routeaddress).

### Route.endpoint

```ts
readonly endpoint!: E
```

The path this route answers. Supports `:name` parameters and a trailing
wildcard, both of which arrive in [`Context.params`](../Context/index.md#context-params).

### Route.config

```ts
readonly config?: RouteConfig<B, S, P, R>
```

Validation schemas and per-route limits. Absent means nothing is validated —
and, since [`getContextAccess`](../ContextAccess/index.md#getcontextaccess) inspects it, absent schemas are one of
the signals that a surface need not be parsed at all.

### Route.handler

```ts
override handler!: ContextHandler<B, S, P, R>
```

The function that answers the request.

Return a value to send it as the body, a `Res` to control the whole
response, or nothing after mutating [`Context.res`](../Context/index.md#context-res) directly.

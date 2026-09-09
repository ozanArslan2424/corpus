# RouteBase

The base every route kind extends, and the address and config types they
share.

`RouteBase` defines what `App` needs from a route to compile it —
a [RouteVariant](#routevariant), a [Method](../Request/index.md#method), an endpoint, an optional
[RouteConfig](#routeconfig), and a handler — plus registration and the direct-call
helpers. The concrete kinds are `Route`, `StaticRoute`,
`FileRoute`, `BundleRoute` and `WebSocketRoute`; extend this
class only to add a kind of your own.

[RouteBase.handle](#routebase-handle) is worth knowing about even if you never subclass:
it invokes a route's handler directly, without a server, which is how routes
are unit tested and how one route can call another in process.

<section class="table-of-contents">

##### Contents

1. [RouteBase](#routebase)
2. [RouteVariant](#routevariant)
3. [RouteConfig](#routeconfig)
4. [RouteAddress](#routeaddress)
5. [resolveRouteAddress](#resolverouteaddress)

</section>

## RouteBase

_class_

```ts
abstract class RouteBase<B = any, S = any, P = any, R = any, E extends string = string>
```

The contract every route kind implements.

Subclasses declare what they are and how they answer; this class supplies
[RouteBase.id](#routebase-id), registration, and the direct-invocation helpers.

The abstract members exist because `App` reads them while compiling —
[RouteBase.variant](#routebase-variant) decides the pipeline shape,
[RouteBase.config](#routebase-config) decides what gets parsed and validated, and the rest
decide where the route sits in the route map.

**Type parameters**

- `B` — Parsed [Context.body](../Context/index.md#context-body) type.
- `S` — Parsed [Context.search](../Context/index.md#context-search) type.
- `P` — Parsed [Context.params](../Context/index.md#context-params) type.
- `R` — Response body type.
- `E` — The literal endpoint type.

### RouteBase.variant

```ts
abstract readonly variant: RouteVariant
```

Which kind of route this is.

### RouteBase.method

```ts
abstract readonly method: Method
```

The HTTP method this route answers.

### RouteBase.endpoint

```ts
abstract readonly endpoint: E
```

The path this route answers, before [App.prefix](../App/index.md#app-prefix) is applied.

### RouteBase.config

```ts
abstract readonly config?: RouteConfig<B, S, P, R>
```

Schemas and limits for this route, if any.

### RouteBase.handler()

```ts
abstract handler(...args: Parameters<ContextHandler<B, S, P, R>>): ReturnType<ContextHandler<B, S, P, R>>;
```

Answers the request. Declared as a method rather than a property so
subclasses can narrow its parameter types — a property declaration would
make the variance error out on routes that take `never` for their inputs.

**Parameters**

- `args` — The [ContextHandler](../Context/index.md#contexthandler) arguments: the `Context` for the request.

**Returns** — The response body, a `Res`, or nothing.

### RouteBase.id

```ts
get id(): string
```

The route's identity, as `"METHOD /endpoint"`.

This is what [Middleware.useOn](../Middleware/index.md#middleware-useon) targets and what
[Controller.routeIds](../Controller/index.md#controller-routeids) collects, so two routes sharing a method and
endpoint share middlewares as well.

**Returns** — The id.

### RouteBase.register()

```ts
register();
```

Appends this route to the nearest `App`. Called by every concrete
route's constructor; a subclass that declares its members as class fields
must call it itself, after those fields are initialized.

### RouteBase.handle()

```ts
handle(data: RouteHandleInput<B, S, P>): MaybePromise<R>
```

Invokes the route's handler directly, with no server and no HTTP.

The inputs are taken as already-parsed values, so nothing is decoded or
validated — and no `Middleware` runs, since middlewares are folded in
by `App` at compile time, not by the route. What this exercises is the
handler itself, which is what makes it useful for unit tests and for calling
one route's logic from another.

**Parameters**

- `data` — The `RouteHandleInput` to build the `Context` from.

**Returns** — Whatever the handler returns.

### RouteBase.request()

```ts
request(data: RouteHandleInput<B, S, P>): Request
```

Builds the request a `RouteHandleInput` describes, so the
`Context` that [RouteBase.handle](#routebase-handle) creates has a real request
behind it — a handler reading [Context.url](../Context/index.md#context-url) or a header gets what it
would have got over the wire.

Params are substituted into the endpoint, so `/users/:id` becomes a concrete
URL. A `FormData` body is passed through untouched, since the runtime sets
its own multipart content type with the boundary; anything else is
JSON-encoded.

**Parameters**

- `data` — The `RouteHandleInput` to build from.

**Returns** — The synthesized request, addressed against [App.baseUrl](../App/index.md#app-baseurl).

## RouteVariant

_const_

```ts
const RouteVariant;
type RouteVariant = ValueOf<typeof RouteVariant>;
```

What kind of route this is. [App.composeRoutes](../App/index.md#app-composeroutes) branches on it — a
`websocket` route upgrades instead of responding, and a `bundle` route is
excluded from `RateLimiter` by default.

One of the [RouteVariant](#routevariant) values.

| Name        | Value         | Description                                              |
| ----------- | ------------- | -------------------------------------------------------- |
| `static`    | `"static"`    | A file whose contents feed a handler. See `StaticRoute`. |
| `file`      | `"file"`      | A single file served as-is. See `FileRoute`.             |
| `dynamic`   | `"dynamic"`   | A handler function. See `Route`.                         |
| `websocket` | `"websocket"` | A connection upgrade. See `WebSocketRoute`.              |
| `bundle`    | `"bundle"`    | A directory of built files. See `BundleRoute`.           |

## RouteConfig

_type_

```ts
type RouteConfig<B = unknown, S = unknown, P = unknown, R = unknown> = {
	/** * Body size ceiling in bytes for this route, enforced by * `enforceBodyLimit`. Tightens [App.maxRequestBodySize](../App/index.md#app-maxrequestbodysize) for a * single endpoint — an upload route and a JSON route rarely want the same * limit. */ maxRequestBodySize?: number;
	/** Schema for the response body. Types the handler's return value. */ response?: Schema<R>;
	/** Schema for the request body. Validated before the handler runs. */ body?: Schema<B>;
	/** Schema for the query string. Validated before the handler runs. */ search?: Schema<S>;
	/** Schema for the path parameters. Validated before the handler runs. */ params?: Schema<P>;
};
```

A route's schemas and per-route limits.

The schemas do double duty: `SchemaParser` validates against them at
request time, and their inferred output types become the `Context`
types the handler sees. [getContextAccess](../Context/ContextAccess/index.md#getcontextaccess) also reads this to decide
what to parse — a surface with a schema is always parsed, since it must be
validated.

**Type parameters**

- `B` — Body type.
- `S` — Search type.
- `P` — Params type.
- `R` — Response type.

### RouteConfig.maxRequestBodySize

```ts
maxRequestBodySize?: number
```

Body size ceiling in bytes for this route, enforced by
`enforceBodyLimit`. Tightens [App.maxRequestBodySize](../App/index.md#app-maxrequestbodysize) for a
single endpoint — an upload route and a JSON route rarely want the same
limit.

### RouteConfig.response

```ts
response?: Schema<R>
```

Schema for the response body. Types the handler's return value.

### RouteConfig.body

```ts
body?: Schema<B>
```

Schema for the request body. Validated before the handler runs.

### RouteConfig.search

```ts
search?: Schema<S>
```

Schema for the query string. Validated before the handler runs.

### RouteConfig.params

```ts
params?: Schema<P>
```

Schema for the path parameters. Validated before the handler runs.

## RouteAddress

_type_

```ts
type RouteAddress<E extends string = string> =
	E | `${Method} ${E}` | `${Lowercase<Method>} ${E}` | { method: Method; endpoint: E };
```

Where a route lives, in any of the forms the constructors accept.

A bare path means [Method.GET](../Request/index.md#method-get). A `"METHOD /path"` string is the usual
form, and the verb may be written in either case. The object form is what
[resolveRouteAddress](#resolverouteaddress) normalizes everything into, and what
`Controller` passes through once it has joined its prefix on.

**Type parameters**

- `E` — The literal endpoint type.

## resolveRouteAddress

_function_

```ts
function resolveRouteAddress<E extends string>(
	address: RouteAddress<E>,
): { endpoint: E; method: Method };
```

Normalizes any [RouteAddress](#routeaddress) form into a method and an endpoint.

The space in `"POST /users"` is what separates the verb from the path, so a
string containing a space must start with a valid verb — otherwise it is a
malformed address rather than a path that happens to contain a space, and it
is rejected loudly at registration time instead of quietly never matching.

**Parameters**

- `address` — The address to resolve, in any accepted form.

**Returns** — The endpoint and its [Method](../Request/index.md#method), with the verb uppercased.

**Throws** — `Error` when a string contains a space but does not begin with an HTTP verb followed by a path.

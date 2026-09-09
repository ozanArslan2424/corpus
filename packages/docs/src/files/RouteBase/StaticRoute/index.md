# StaticRoute

Serving a file read once at startup, optionally through a handler.

`StaticRoute` is the [RouteVariant.static](../index.md#routevariant-static) member of the
`RouteBase` family. Unlike `FileRoute`, which reads its file per
request, this one reads at construction and holds the bytes — so the file is
served from memory, and changes on disk are not picked up until the process
restarts.

The optional callback receives the file's contents as text, which is what
makes this the route for templating: an HTML shell can have values injected
into it before being sent.

```ts
import { StaticRoute } from "@ozanarslan/corpus";

new StaticRoute("GET /about", "./pages/about.html");
new StaticRoute("GET /", "./pages/index.html", (c, html) => html.replace("{{title}}", title));
```

<section class="table-of-contents">

##### Contents

1. [StaticRoute](#staticroute)

</section>

## StaticRoute

_class_

```ts
class StaticRoute<B = unknown, S = unknown, P = unknown, E extends string = string, >extends RouteBase<B, S, P, StaticRouteRes, E>
```

Serves a file held in memory, optionally passing it through a callback first.

The file is read once during construction and kept as bytes, so every request
is answered without touching the filesystem. A file that does not exist at
that point is not an error — the route registers, and requests reach
[StaticRoute.onFileNotFound](#staticroute-onfilenotfound) instead.

**Type parameters**

- `B` — Parsed [Context.body](../../Context/index.md#context-body) type.
- `S` — Parsed [Context.search](../../Context/index.md#context-search) type.
- `P` — Parsed [Context.params](../../Context/index.md#context-params) type.
- `E` — The literal endpoint type, carried so the endpoint stays narrowly typed at the call site.

### StaticRoute.constructor()

```ts
constructor();
constructor(address: RouteAddress<E>, filePath: string, callback?: StaticRouteCallback<B, S, P>, config?: StaticRouteConfig<B, S, P>, );
constructor(address?: RouteAddress<E>, filePath?: string, callback?: StaticRouteCallback<B, S, P>, config?: StaticRouteConfig<B, S, P>, )
```

Creates a static route for subclasses, which declare
[StaticRoute.endpoint](#staticroute-endpoint) and [StaticRoute.file](#staticroute-file) as class fields and
call [RouteBase.register](../index.md#routebase-register) themselves.

Creates a static route, reads its file, and registers it on the nearest
`App`.

**Parameters**

- `address` — The [RouteAddress](../index.md#routeaddress): a `"METHOD /endpoint"` string or a method-and-endpoint pair.
- `filePath` — Path to the file, read now rather than per request.
- `callback` — Optional `StaticRouteCallback` to transform the contents before sending. Omit it to send the file as-is.
- `config` — Optional `StaticRouteConfig` with validation schemas and a caching policy.

### StaticRoute.file

```ts
file: Nullable<XFile>;
```

The file this route serves. Kept for its mime type and name; the contents
live in [StaticRoute.bytes](#staticroute-bytes).

### StaticRoute.bytes

```ts
bytes: Nullable<Uint8Array>;
```

The file's contents, read at construction. `null` when the file did not
exist then, which is what sends requests to
[StaticRoute.onFileNotFound](#staticroute-onfilenotfound).

### StaticRoute.cacheHeader

```ts
cacheHeader: string;
```

The `Cache-Control` value sent with the file, rendered from the config at
construction rather than per request.

### StaticRoute.callback

```ts
callback?: StaticRouteCallback<B, S, P>
```

Transforms the file's contents before they are sent. Absent means the bytes
are sent unchanged.

### StaticRoute.onFileNotFound

```ts
onFileNotFound: () => Promise<StaticRouteRes>;
```

Decides what to serve when the file was missing at construction. Replace it
to serve a placeholder or redirect instead of throwing.

**Returns** — The `StaticRouteRes` to send instead.

**Throws** — `Exception` with [Status.NOT_FOUND](../../Res/index.md#status-not-found) by default.

### StaticRoute.variant

```ts
override readonly variant: RouteVariant
```

Marks this route as [RouteVariant.static](../index.md#routevariant-static) for `App` route compilation.

### StaticRoute.method

```ts
override method: Method
```

The method the file is served on. Taken from the [RouteAddress](../index.md#routeaddress); defaults to [Method.GET](../../Request/index.md#method-get).

### StaticRoute.endpoint

```ts
override endpoint!: E
```

The path the file is served at.

### StaticRoute.config

```ts
override config?: RouteConfig<B, S, P, StaticRouteRes>
```

Validation schemas for the route. The caching policy is stripped out during
construction, so what remains is a plain [RouteConfig](../index.md#routeconfig).

### StaticRoute.handler

```ts
override handler: ContextHandler<B, S, P, StaticRouteRes>
```

Sends the file, or the callback's transformation of it.

The content type, caching and length headers are set from the file before
the callback runs, so a callback that changes the content's length — or
returns a `Res` of its own — should set those headers itself.

**Parameters**

- `c` — The `Context` for the request.

**Returns** — The file's bytes, or whatever the [StaticRoute.callback](#staticroute-callback) returned. Falls through to [StaticRoute.onFileNotFound](#staticroute-onfilenotfound) when the file was missing at construction.

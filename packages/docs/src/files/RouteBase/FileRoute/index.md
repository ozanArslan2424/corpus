# FileRoute

Serving a single file from a single endpoint.

`FileRoute` is the [RouteVariant.file](../index.md#routevariant-file) member of the
`RouteBase` family, and the narrowest of the file-serving routes: one
endpoint, one file, no path resolution. Reach for `BundleRoute` to serve
a whole directory, or `StaticRoute` when the file's contents feed a
handler rather than being sent as-is.

```ts
import { FileRoute } from "@ozanarslan/corpus";

new FileRoute("GET /robots.txt", "./public/robots.txt");
new FileRoute("GET /report", { filePath: "./report.pdf", disposition: "attachment" });
```

<section class="table-of-contents">

##### Contents

1. [FileRoute](#fileroute)

</section>

## FileRoute

_class_

```ts
class FileRoute<E extends string = string>extends RouteBase<never, never, never, FileRouteRes, E>
```

Serves one file at one endpoint.

The file is read per request, not at registration, so replacing it on disk
takes effect without a restart — and a file that does not exist yet is not an
error until someone asks for it.

How the body is sent depends on [FileRoute.disposition](#fileroute-disposition): with one set,
the file is streamed and carries a `Content-Disposition`; without one, it is
read into memory and carries an exact `Content-Length`.

**Type parameters**

- `E` — The literal endpoint type, carried so the endpoint stays narrowly typed at the call site.

### FileRoute.constructor()

```ts
constructor();
constructor(address: RouteAddress<E>, definition: FileRouteDefinition | string);
constructor(address?: RouteAddress<E>, definition?: FileRouteDefinition | string)
```

Creates a file route for subclasses, which declare
[FileRoute.endpoint](#fileroute-endpoint) and [FileRoute.filePath](#fileroute-filepath) as class fields
and call [RouteBase.register](../index.md#routebase-register) themselves.

Creates a file route and registers it on the nearest `App`.

**Parameters**

- `address` — The [RouteAddress](../index.md#routeaddress): a `"METHOD /endpoint"` string or a method-and-endpoint pair.
- `definition` — A `FileRouteDefinition`, or just the file path when the default caching and inline sending are fine.

### FileRoute.filePath

```ts
filePath!: string
```

Path to the file to serve, read fresh on every request.

### FileRoute.disposition

```ts
disposition?: ContentDispositionDefinition["disposition"]
```

The `Content-Disposition` to send — `"inline"` to display in the browser,
`"attachment"` to download under the file's own name.

Setting it also switches the route to streaming, so large downloads are
never buffered. Leaving it unset sends the bytes with a `Content-Length`
instead, which suits small files a client may want to cache or range over.

### FileRoute.cache

```ts
cache: CacheControlDefinition;
```

Caching policy, rendered into `Cache-Control` by
[createCacheControlHeader](../../Headers/index.md#createcachecontrolheader). Defaults to one hour of public caching.

### FileRoute.onFileNotFound

```ts
onFileNotFound: () => Promise<FileRouteRes>;
```

Decides what to serve when [FileRoute.filePath](#fileroute-filepath) does not exist at
request time. Replace it to serve a placeholder or redirect instead of
throwing.

**Returns** — The `FileRouteRes` to send instead.

**Throws** — `Exception` with [Status.NOT_FOUND](../../Res/index.md#status-not-found) by default.

### FileRoute.variant

```ts
override readonly variant: RouteVariant
```

Marks this route as [RouteVariant.file](../index.md#routevariant-file) for `App` route compilation.

### FileRoute.method

```ts
override method: Method
```

The method the file is served on. Taken from the [RouteAddress](../index.md#routeaddress); defaults to [Method.GET](../../Request/index.md#method-get).

### FileRoute.endpoint

```ts
override endpoint!: E
```

The path the file is served at.

### FileRoute.config

```ts
override config?: RouteConfig<never, never, never, FileRouteRes> | undefined
```

File routes take no params, search or body, so no [RouteConfig](../index.md#routeconfig)
schemas apply.

### FileRoute.handler

```ts
override handler: ContextHandler<never, never, never, FileRouteRes>
```

Reads the file and sends it, setting the content type, caching and length or
disposition headers on [Context.res](../../Context/index.md#context-res).

**Parameters**

- `c` — The `Context` for the request.

**Returns** — The file body — a stream when [FileRoute.disposition](#fileroute-disposition) is set, bytes otherwise — or whatever [FileRoute.onFileNotFound](#fileroute-onfilenotfound) produced.

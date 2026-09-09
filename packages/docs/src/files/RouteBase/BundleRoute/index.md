# BundleRoute

Serving for a directory of built front-end files: hashed assets, an entry
document, and per-file-class caching.

`BundleRoute` is the [RouteVariant.bundle](../index.md#routevariant-bundle) member of the
`RouteBase` family. It serves any directory of servable files, deriving
cache headers from what kind of file each one is — immutable for build-hashed
assets, revalidated for the entry document, and a configurable fallback for
everything else. Its distinguishing behaviour is the entry-document fallback:
a path that resolves to no file is answered with the entry HTML instead of a
404, which is what makes a single-page app survive a hard refresh on a client
route. That fallback is the main use, not the only one — `StaticRoute`
remains the plainer choice when a bundle's caching and fallback behaviour is
not wanted.

```ts
new BundleRoute("/*", "./dist");
```

<section class="table-of-contents">

##### Contents

1. [BundleRoute](#bundleroute)

</section>

## BundleRoute

_class_

```ts
class BundleRoute<E extends string = string>extends RouteBase<never, never, never, BundleRouteRes, E>
```

Serves a directory of built files.

Register it on a wildcard endpoint so every path below it reaches the route.
A request resolves in three steps: the endpoint prefix is stripped to a
sub-path by [BundleRoute.resolveSubPath](#bundleroute-resolvesubpath), the sub-path is joined onto
[BundleRoute.dir](#bundleroute-dir) by [BundleRoute.resolveTargetPath](#bundleroute-resolvetargetpath), and
[BundleRoute.resolveFile](#bundleroute-resolvefile) serves the result if it exists. When it does
not and the request is not for an HTML file, the entry document named by
[BundleRoute.indexHtmlPath](#bundleroute-indexhtmlpath) is served instead.

Files are matched against [BundleRoute.definition](#bundleroute-definition) to pick their
`Cache-Control`: the entry document, anything under
[BundleRoute.assetsDirPath](#bundleroute-assetsdirpath), and everything else each get their own
policy.

Paths that escape [BundleRoute.dir](#bundleroute-dir) are rejected by
[BundleRoute.isTraversalAttempt](#bundleroute-istraversalattempt) before the filesystem is touched, so
`..` segments cannot reach files outside the directory.

**Type parameters**

- `E` — The literal endpoint type, carried so the endpoint stays narrowly typed at the call site.

### BundleRoute.constructor()

```ts
constructor();
constructor(endpoint: E, dir: string, definition?: BundleRouteDefinition);
constructor(endpoint?: E, dir?: string, definition?: BundleRouteDefinition)
```

Creates a bundle route for subclasses, which declare
[BundleRoute.endpoint](#bundleroute-endpoint) and [BundleRoute.dir](#bundleroute-dir) as class fields and
call [RouteBase.register](../index.md#routebase-register) themselves.

Creates a bundle route and registers it on the nearest `App`.

**Parameters**

- `endpoint` — The path to serve the directory under. Use a wildcard so nested paths reach the route.
- `dir` — Directory to serve from. Every resolved path is confined to it.
- `definition` — Optional `BundleRouteDefinition` overriding the bundle layout and caching policy. Defaults to `DEFAULT_DEFINITION`.

### BundleRoute.dir

```ts
dir!: string
```

Directory the files are served from. Every path resolved by the route is
confined to it.

### BundleRoute.ignore

```ts
ignore: Array<string>;
```

Sub-paths that are answered with the entry document rather than the file
they name. A trailing `*` makes a pattern a prefix match; leading slashes
are optional.

Useful when a client-side route collides with a real file in the directory,
or to keep a build artefact from being reachable.

### BundleRoute.definition

```ts
definition: BundleRouteDefinition;
```

The bundle's layout and caching policy. Defaults to
`DEFAULT_DEFINITION`.

### BundleRoute.indexHtmlPath

```ts
get indexHtmlPath(): string
```

Path of the entry document within [BundleRoute.dir](#bundleroute-dir).

**Returns** — The path from `BundleRouteDefinition.indexHtml`, or the `DEFAULT_DEFINITION` value when it declares none.

### BundleRoute.assetsDirPath

```ts
get assetsDirPath(): string
```

Path of the hashed-assets directory within [BundleRoute.dir](#bundleroute-dir).

**Returns** — The path from `BundleRouteDefinition.assetsDir`, or the `DEFAULT_DEFINITION` value when it declares none.

### BundleRoute.getEndpoints()

```ts
getEndpoints(): Array<string>
```

Lists every file this route can serve, as sub-paths relative to
[BundleRoute.dir](#bundleroute-dir).

Walks [BundleRoute.dir](#bundleroute-dir) recursively and returns each file's path
with a leading `/`, matching what [BundleRoute.resolveSubPath](#bundleroute-resolvesubpath) would
produce for a request reaching that file. Useful for generating a sitemap
or verifying what a deployed bundle actually contains.

**Returns** — The sub-paths of every file under [BundleRoute.dir](#bundleroute-dir).

### BundleRoute.onFileNotFound

```ts
onFileNotFound: (subPath: string) => MaybePromise<BundleRouteRes>;
```

Decides what to serve when a request resolves to no readable file — an HTML
file that is genuinely missing, a directory with no entry document, or a
path rejected by [BundleRoute.isTraversalAttempt](#bundleroute-istraversalattempt).

Replace it to serve a custom 404 page or redirect instead of throwing.

**Parameters**

- `subPath` — The request path with the endpoint prefix stripped, as the client asked for it.

**Returns** — The `BundleRouteRes` to send instead.

**Throws** — `Exception` with [Status.NOT_FOUND](../../Res/index.md#status-not-found) by default.

### BundleRoute.resolveFile()

```ts
protected resolveFile(targetPath: string): XFile | null
```

Resolves a filesystem path to a readable `XFile`, applying the
entry-document fallback.

A missing non-HTML path falls back to the entry document, which is what
serves client-side routes. A missing HTML path does not fall back — asking
for a specific document that does not exist is a real 404 rather than a
client route.

**Parameters**

- `targetPath` — Path produced by [BundleRoute.resolveTargetPath](#bundleroute-resolvetargetpath).

**Returns** — The `XFile` to serve, or `null` when nothing readable was found, which sends the request to [BundleRoute.onFileNotFound](#bundleroute-onfilenotfound).

### BundleRoute.resolveSubPath()

```ts
protected resolveSubPath(pathname: string): string
```

Strips the route's own prefix from a request pathname, leaving the path
relative to [BundleRoute.dir](#bundleroute-dir).

Both `/*` and `*` endpoint suffixes are handled, and a pathname that does
not start with the prefix is returned untouched. The result is percent-decoded,
since `URL.pathname` leaves escapes like `%20` intact and filesystem
paths need the literal characters.

**Parameters**

- `pathname` — The pathname of the incoming request.

**Returns** — The bundle-relative sub-path, `""` or `/` for the route root.

### BundleRoute.resolveTargetPath()

```ts
protected resolveTargetPath(subPath: string): string
```

Joins a sub-path onto [BundleRoute.dir](#bundleroute-dir) to get the file to read.

The route root maps to the entry document, as does any sub-path matching
[BundleRoute.ignore](#bundleroute-ignore). The result is not yet known to be safe —
[BundleRoute.isTraversalAttempt](#bundleroute-istraversalattempt) checks it before it is opened.

**Parameters**

- `subPath` — The sub-path from [BundleRoute.resolveSubPath](#bundleroute-resolvesubpath).

**Returns** — The joined filesystem path.

### BundleRoute.isTraversalAttempt()

```ts
protected isTraversalAttempt(targetPath: string): boolean
```

Reports whether a resolved path escapes [BundleRoute.dir](#bundleroute-dir).

Both sides are fully resolved before comparison, so `..` segments and
encoded variants are normalised away rather than matched textually. The
separator check keeps a sibling directory sharing the root's name prefix
from passing.

**Parameters**

- `targetPath` — Path from [BundleRoute.resolveTargetPath](#bundleroute-resolvetargetpath).

**Returns** — `true` when the path lies outside the served directory, in which case the request goes to [BundleRoute.onFileNotFound](#bundleroute-onfilenotfound) without the file being opened.

### BundleRoute.resolveResponseData()

```ts
protected resolveResponseData(file: XFile, ): Tuple<ReadableStream | Uint8Array, Record<string, string>>
```

Produces the response body and headers for a resolved file.

`Cache-Control` is chosen by matching the file against
[BundleRoute.definition](#bundleroute-definition): the entry document first, then anything
under [BundleRoute.assetsDirPath](#bundleroute-assetsdirpath), then
`BundleRouteDefinition.fallback`. No fallback means no header.

Non-HTML files are streamed and carry an inline
`Content-Disposition`, so large assets are never buffered. HTML is read into
memory instead, which lets it carry an exact `Content-Length` — the entry
document is small and served constantly, so the length is worth more than
the streaming.

**Parameters**

- `file` — The `XFile` resolved for the request.

**Returns** — A `Tuple` of the body and the headers to set on [Res.headers](../../Res/index.md#res-headers).

### BundleRoute.variant

```ts
override readonly variant: RouteVariant
```

Marks this route as [RouteVariant.bundle](../index.md#routevariant-bundle) for `App` route compilation.

### BundleRoute.method

```ts
override readonly method: Method
```

Bundles answer [Method.GET](../../Request/index.md#method-get) only.

### BundleRoute.endpoint

```ts
override endpoint!: E
```

The path the directory is served under. Use a wildcard so nested paths reach
the route; [BundleRoute.resolveSubPath](#bundleroute-resolvesubpath) strips the wildcard suffix.

### BundleRoute.config

```ts
override readonly config?: RouteConfig<never, never, never, BundleRouteRes>
```

Bundles take no params, search or body, so no [RouteConfig](../index.md#routeconfig) schemas
apply.

### BundleRoute.handler

```ts
override handler: ContextHandler<never, never, never, BundleRouteRes>
```

Serves the file a request resolves to.

Resolves the sub-path and target path, rejects traversal attempts, reads the
file, then sets the headers from [BundleRoute.resolveResponseData](#bundleroute-resolveresponsedata) on
[Context.res](../../Context/index.md#context-res) and returns the body. Anything that fails to resolve
goes to [BundleRoute.onFileNotFound](#bundleroute-onfilenotfound).

**Parameters**

- `c` — The `Context` for the request.

**Returns** — The file body — a stream for non-HTML, bytes for HTML — or whatever [BundleRoute.onFileNotFound](#bundleroute-onfilenotfound) produced.

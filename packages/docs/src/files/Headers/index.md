# Headers

Header names, header-value builders, and the `Headers` extensions the
framework relies on.

Two things happen here. [HeaderKey](#headerkey) gives the common header names as
documented constants, so header access is autocompleted and typo-free rather
than stringly typed. [patchGlobalHeaders](#patchglobalheaders) then extends the global
`Headers` class with conveniences the native API lacks: non-string values,
bulk assignment through [Headers.setMany](#headers-setmany), and structured builders for
`Cache-Control` and `Content-Disposition`.

The patch is what lets `Res`, `FileRoute` and `BundleRoute`
write headers without stringifying every value by hand. It applies to the
process's own `Headers`, so it must be installed once at startup, before any
request is served.

<section class="table-of-contents">

##### Contents

1. [Headers](#headers)
2. [patchGlobalHeaders](#patchglobalheaders)
3. [createCacheControlHeader](#createcachecontrolheader)
4. [createContentDispositionHeader](#createcontentdispositionheader)
5. [readHeader](#readheader)
6. [HeaderKey](#headerkey)
7. [ContentDispositionDefinition](#contentdispositiondefinition)
8. [CacheControlDefinition](#cachecontroldefinition)

</section>

## Headers

_interface_ — augments `global`

```ts
interface Headers
```

The `Headers` surface after [patchGlobalHeaders](#patchglobalheaders) has run.

The existing methods are re-declared to accept a [HeaderKey](#headerkey) and a
`HeadersInitValue`; the rest are additions.

### Headers.append()

```ts
append(name: HeaderKey, value: MaybeArray<HeadersInitValue>): void
```

Adds a value without replacing existing ones. An array appends each item as its own header line.

### Headers.set()

```ts
set(name: HeaderKey, value: HeadersInitValue): void
```

Sets a header, replacing any existing value. Numbers and booleans are stringified.

### Headers.get()

```ts
get(name: HeaderKey): Nullable<string>
```

Reads a header, falling back to the lowercased name.

### Headers.has()

```ts
has(name: HeaderKey): boolean
```

Reports whether a header is present, falling back to the lowercased name.

### Headers.setMany()

```ts
setMany(init: CustomHeadersInit): void
```

Sets many headers at once. See `CustomHeadersInit`.

### Headers.setCacheControl()

```ts
setCacheControl(def: CacheControlDefinition): void
```

Sets `Cache-Control` from a [CacheControlDefinition](#cachecontroldefinition).

### Headers.setContentDisposition()

```ts
setContentDisposition(def: ContentDispositionDefinition): void
```

Sets `Content-Disposition` from a [ContentDispositionDefinition](#contentdispositiondefinition).

## patchGlobalHeaders

_function_

```ts
function patchGlobalHeaders();
```

Installs the extended `Headers` behaviour declared above onto the global
class. Call it once at startup, before any request is served.

The patch is applied twice over, deliberately. The prototype methods are
replaced so headers _the runtime_ created — those on an incoming `Request`, or
on a `Response` built elsewhere — gain the same behaviour. The global class is
then also replaced with a subclass, so instances constructed after the patch
carry the methods as own class members rather than only as prototype
assignments.

The subclass overrides `Symbol.hasInstance` to defer to the native class, so
`instanceof Headers` stays true for objects the runtime created before or
outside the patch. Without it, the swap would silently break every
`instanceof` check against headers the framework did not construct.

## createCacheControlHeader

_function_

```ts
function createCacheControlHeader(def: CacheControlDefinition): string;
```

Renders a [CacheControlDefinition](#cachecontroldefinition) into a `Cache-Control` header value.

The two prohibitive directives take precedence and are emitted alone, since
combining them with freshness directives is contradictory: `noStore` wins over
everything, then `noCache`. Otherwise the remaining directives are joined in
order.

**Parameters**

- `def` — The caching policy to render.

**Returns** — The header value, or an empty string when the definition sets nothing.

## createContentDispositionHeader

_function_

```ts
function createContentDispositionHeader(def: ContentDispositionDefinition);
```

Renders a [ContentDispositionDefinition](#contentdispositiondefinition) into a `Content-Disposition`
header value.

**Parameters**

- `def` — The disposition to render.

**Returns** — The header value, with a quoted `filename` parameter when one is given.

## readHeader

_function_

```ts
function readHeader(headers: Optional<HeadersInit>, name: HeaderKey): Nullable<string>;
```

Reads a header from any `HeadersInit` shape, without constructing a `Headers`.

Header names are case-insensitive, so every shape is matched case-insensitively:
a `Headers` instance is probed with both casings, and the array and object
forms are scanned with lowercased comparison.

**Parameters**

- `headers` — The headers to read, in any accepted form. `undefined` and `null` are allowed and yield `null`.
- `name` — The header to look for.

**Returns** — The value, or `null` when absent.

## HeaderKey

_const_

```ts
const HeaderKey;
type HeaderKey = OrString<ValueOf<typeof HeaderKey>>;
```

Just some common headers. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) for the full spec.

A header name. The [HeaderKey](#headerkey) constants are suggested, but
`OrString` keeps any custom header name assignable — the enum is a
convenience, not a restriction.

| Name                            | Value                                | Description                                                                                                 |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `CacheControl`                  | `"Cache-Control"`                    | Controls caching mechanisms for requests and responses.                                                     |
| `ContentType`                   | `"Content-Type"`                     | Specifies the media type of the resource or data.                                                           |
| `ContentLength`                 | `"Content-Length"`                   | Indicates the size of the entity-body in bytes.                                                             |
| `ContentDisposition`            | `"Content-Disposition"`              | Whether to display payload inline within the page or prompt the user to download it as an attachment.       |
| `AcceptEncoding`                | `"Accept-Encoding"`                  | Specifies the character encodings that are acceptable.                                                      |
| `Accept`                        | `"Accept"`                           | Informs the server about the types of data that can be sent back.                                           |
| `Authorization`                 | `"Authorization"`                    | Contains the credentials to authenticate with the server.                                                   |
| `UserAgent`                     | `"User-Agent"`                       | The user agent string of the client software.                                                               |
| `Host`                          | `"Host"`                             | The domain name of the server and port number.                                                              |
| `Referer`                       | `"Referer"`                          | The address of the previous web page from which the current request originated.                             |
| `Connection`                    | `"Connection"`                       | Indicates whether the connection should be kept alive.                                                      |
| `Upgrade`                       | `"Upgrade"`                          | Requests that the server switch to a different protocol (e.g. WebSocket).                                   |
| `Pragma`                        | `"Pragma"`                           | Used to specify directives that must be obeyed by caching mechanisms.                                       |
| `Date`                          | `"Date"`                             | The date and time at which the message was sent.                                                            |
| `IfNoneMatch`                   | `"If-None-Match"`                    | Makes the request conditional based on the ETag of the resource.                                            |
| `IfModifiedSince`               | `"If-Modified-Since"`                | Makes the request conditional based on the last modification date.                                          |
| `ETag`                          | `"ETag"`                             | An identifier for a specific version of a resource.                                                         |
| `Expires`                       | `"Expires"`                          | The date and time after which the response is considered stale.                                             |
| `LastModified`                  | `"Last-Modified"`                    | The last modification date of the resource.                                                                 |
| `Location`                      | `"Location"`                         | Indicates the URL to redirect a page to.                                                                    |
| `WWWAuthenticate`               | `"WWW-Authenticate"`                 | Defines the authentication method that should be used.                                                      |
| `AccessControlMaxAge`           | `"Access-Control-Max-Age"`           | Determines how long the results of a preflight request can be cached.                                       |
| `AccessControlAllowCredentials` | `"Access-Control-Allow-Credentials"` | Indicates whether the response can be shared with resources with credentials.                               |
| `AccessControlRequestMethod`    | `"Access-Control-Request-Method"`    | Indicates which HTTP method will be used in the actual CORS request.                                        |
| `AccessControlExposeHeaders`    | `"Access-Control-Expose-Headers"`    | Indicates which headers can be exposed to the browser in a CORS response.                                   |
| `AccessControlAllowOrigin`      | `"Access-Control-Allow-Origin"`      | Indicates which origins are allowed to access the resource.                                                 |
| `AccessControlAllowMethods`     | `"Access-Control-Allow-Methods"`     | Specifies the HTTP methods allowed when accessing the resource in a CORS request.                           |
| `AccessControlAllowHeaders`     | `"Access-Control-Allow-Headers"`     | Specifies the HTTP headers allowed in a CORS request.                                                       |
| `SetCookie`                     | `"Set-Cookie"`                       | Sends cookies from the server to the client.                                                                |
| `Cookie`                        | `"Cookie"`                           | Sends cookies from the client to the server.                                                                |
| `Vary`                          | `"Vary"`                             | Determines which headers should be used to select a response from cache when content negotiation is in use. |
| `XContentTypeOptions`           | `"X-Content-Type-Options"`           | Set to "nosniff" by default in `Res`.                                                                       |

## ContentDispositionDefinition

_interface_

```ts
interface ContentDispositionDefinition
```

How a response body should be presented, rendered by
[createContentDispositionHeader](#createcontentdispositionheader).

| Name          | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `disposition` | `"inline"` to display in the browser, `"attachment"` to prompt a download. |
| `filename`    | The name to save the file under. Omit it to let the client decide.         |

## CacheControlDefinition

_interface_

```ts
interface CacheControlDefinition
```

A caching policy, rendered into a `Cache-Control` value by
[createCacheControlHeader](#createcachecontrolheader). Used by [FileRoute.cache](../RouteBase/FileRoute/index.md#fileroute-cache) and by each
entry of a `BundleRouteDefinition`.

| Name        | Description                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `public`    | Allows shared caches — proxies and CDNs — to store the response, not just the browser.                                               |
| `maxAge`    | How long the response stays fresh, in seconds.                                                                                       |
| `immutable` | Promises the response will never change, so the browser skips revalidation entirely. Only meaningful with a content hash in the URL. |
| `noCache`   | Caches the response but revalidates before every use. Overrides the other directives except `noStore`.                               |
| `noStore`   | Forbids storing the response anywhere. Overrides every other directive.                                                              |

# Res

Response building: status codes, body serialization, streaming, and cookies.

A `Res` is what a handler shapes on its way to a native `Response`. It
is created lazily on [Context.res](../Context/index.md#context-res), so a handler that just returns a
value never constructs one; reach for it when the response needs a status,
headers, cookies, or a body form that a plain return value cannot express —
a file, a redirect, or a stream.

Body serialization is inferred from the value's type at
[Res.toNativeResponse](#res-tonativeresponse) time, so an object becomes JSON, a typed array
stays binary, and a stream passes through untouched — each with a matching
`Content-Type` unless one was set explicitly.

```ts
import { Res, Status } from "@ozanarslan/corpus";

new Res({ id: 1 }, { status: Status.CREATED });
new Res().file("./report.pdf");
new Res().redirect("/login");
```

<section class="table-of-contents">

##### Contents

1. [Res](#res)
2. [Status](#status)

</section>

## Res

_class_

```ts
class Res<R = unknown>
```

A response under construction.

Everything is mutable until [Res.toNativeResponse](#res-tonativeresponse) is called, so a
`Middleware` can adjust a response a route handler already built. The
body is kept as the original value rather than serialized eagerly, which is
what lets the content type be inferred from it at the very end.

Headers and cookies are both lazy, so an untouched response allocates neither.
The chainable methods — [Res.file](#res-file), [Res.redirect](#res-redirect),
[Res.sse](#res-sse) and the rest — set the body and its headers together and
return `this`.

**Type parameters**

- `R` — The body type, carried from the route's own response type.

### Res.constructor()

```ts
constructor(body?: Nullable<BodyInit | R>, init?: ResInit)
```

Creates a response.

**Parameters**

- `body` — The body value. Serialized by `resolveResBody` at [Res.toNativeResponse](#res-tonativeresponse) time, not now.
- `init` — Status, status text, headers and cookies. See `ResInit`.

### Res.body

```ts
body: Nullable<BodyInit | R>;
```

The body to send. Assign any value — objects become JSON, typed arrays stay
binary, streams pass through — and `resolveResBody` works out the rest
at serialization time.

### Res.status

```ts
status: number;
```

The status code. Defaults to [Status.OK](#status-ok).

### Res.statusText

```ts
statusText: string;
```

The status text. Empty by default, which lets the runtime supply the standard phrase.

### Res.headers

```ts
get headers(): Headers
```

The response headers.

Reading them rewrites the `Set-Cookie` lines from [Res.cookies](#res-cookies) first,
so the two views never disagree — and writing `Set-Cookie` here feeds back
into the cookie map. Values may be numbers or booleans, since
[patchGlobalHeaders](../Headers/index.md#patchglobalheaders) has stringified setters.

**Returns** — The headers, created on first access.

### Res.cookies

```ts
get cookies(): Cookies
```

The cookies to send, as a mutable map.

This is the authoritative view: the map is serialized into `Set-Cookie`
whenever [Res.headers](#res-headers) is read, so deleting a cookie here removes its
header. Values are percent-encoded on serialization, which is what keeps a
CRLF in a cookie value from splitting the response.

**Returns** — The `Cookies` map, created on first access.

### Res.toNativeResponse()

```ts
toNativeResponse(): Response
```

Serializes everything into a native `Response`.

The content type inferred from the body is applied only when none was set
explicitly, so a handler's own choice always wins. `X-Content-Type-Options:
nosniff` is set unconditionally — without it a browser will sniff a
`text/plain` body that looks like markup and render it as HTML, turning any
reflected value into XSS.

**Returns** — The response to send over the wire. Called by [App.respond](../App/index.md#app-respond).

### Res.sse()

```ts
sse(source: SseSource, retry?: number): this
```

Turns the response into a server-sent event stream.

Sets the body to a stream and the headers browsers require for `EventSource`
to work — the event stream type, no caching, and a kept-alive connection.

**Parameters**

- `source` — The `SseSource` producing events. Return a cleanup function from it to keep the stream open indefinitely.
- `retry` — Reconnection delay in milliseconds, sent with every event to tell the client how long to wait before reconnecting.

**Returns** — This response, for chaining.

### Res.ndjson()

```ts
ndjson(source: NdjsonSource): this
```

Turns the response into a newline-delimited JSON stream.

Each item is serialized onto its own line, so a client can parse results as
they arrive instead of waiting for a whole array. Useful for large result
sets and progressive output where the event semantics of [Res.sse](#res-sse) are
not needed.

**Parameters**

- `source` — The `NdjsonSource` producing items. Return a cleanup function from it to keep the stream open indefinitely.

**Returns** — This response, for chaining.

### Res.streamFile()

```ts
streamFile(fileOrPath: XFile | string, disposition: ContentDispositionDefinition["disposition"], ): this
```

Streams a file as the response body, without reading it into memory. Prefer
this over [Res.file](#res-file) for anything large.

**Parameters**

- `fileOrPath` — An `XFile` or a path to one.
- `disposition` — `"inline"` to display in the browser, `"attachment"` to prompt a download under the file's own name.

**Returns** — This response, for chaining.

**Throws** — `Exception` with [Status.NOT_FOUND](#status-not-found) when the file does not exist.

### Res.file()

```ts
file(fileOrPath: XFile | string): this
```

Sends a file as the response body, read into memory so it can carry an exact
`Content-Length`. Use [Res.streamFile](#res-streamfile) instead for large files.

**Parameters**

- `fileOrPath` — An `XFile` or a path to one.

**Returns** — This response, for chaining.

**Throws** — `Exception` with [Status.NOT_FOUND](#status-not-found) when the file does not exist.

### Res.redirect()

```ts
redirect(url: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302): this
```

Redirects the client to another URL.

**Parameters**

- `url` — Where to send the client, absolute or relative.
- `status` — Which redirect to use. Defaults to [Status.FOUND](#status-found), a temporary redirect that browsers do not cache. See [Res.permanentRedirect](#res-permanentredirect), [Res.temporaryRedirect](#res-temporaryredirect) and [Res.seeOther](#res-seeother) for the named alternatives.

**Returns** — This response, for chaining.

### Res.permanentRedirect()

```ts
permanentRedirect(url: string | URL): this
```

Redirects with [Status.MOVED_PERMANENTLY](#status-moved-permanently), which browsers and search
engines cache indefinitely. Use it only when the resource has really moved
for good.

**Parameters**

- `url` — Where to send the client.

**Returns** — This response, for chaining.

### Res.temporaryRedirect()

```ts
temporaryRedirect(url: string | URL): this
```

Redirects with [Status.TEMPORARY_REDIRECT](#status-temporary-redirect), which preserves the
original method and body — unlike [Status.FOUND](#status-found), which clients
commonly turn into a GET.

**Parameters**

- `url` — Where to send the client.

**Returns** — This response, for chaining.

### Res.seeOther()

```ts
seeOther(url: string | URL): this
```

Redirects with [Status.SEE_OTHER](#status-see-other), which explicitly switches the
client to a GET. This is the correct redirect after a successful POST, since
it stops a refresh from resubmitting the form.

**Parameters**

- `url` — Where to send the client.

**Returns** — This response, for chaining.

## Status

_const_

```ts
const Status;
type Status = ValueOf<typeof Status> | (number & {});
```

Commonly used HTTP status codes.

An HTTP status code. The [Status](#status) constants are suggested, but any
number is assignable.

| Name                              | Value | Description                                                   |
| --------------------------------- | ----- | ------------------------------------------------------------- |
| `CONTINUE`                        | `100` | Continue: Request received, please continue                   |
| `SWITCHING_PROTOCOLS`             | `101` | Switching Protocols: Protocol change request approved         |
| `PROCESSING`                      | `102` | Processing (WebDAV)                                           |
| `EARLY_HINTS`                     | `103` | Early Hints                                                   |
| `OK`                              | `200` | OK: Request succeeded                                         |
| `CREATED`                         | `201` | Created: Resource created                                     |
| `ACCEPTED`                        | `202` | Accepted: Request accepted but not completed                  |
| `NON_AUTHORITATIVE_INFORMATION`   | `203` | Non-Authoritative Information                                 |
| `NO_CONTENT`                      | `204` | No Content: Request succeeded, no body returned               |
| `RESET_CONTENT`                   | `205` | Reset Content: Clear form or view                             |
| `PARTIAL_CONTENT`                 | `206` | Partial Content: Partial GET successful (e.g. range requests) |
| `MULTI_STATUS`                    | `207` | Multi-Status (WebDAV)                                         |
| `ALREADY_REPORTED`                | `208` | Already Reported (WebDAV)                                     |
| `IM_USED`                         | `226` | IM Used (HTTP Delta encoding)                                 |
| `MULTIPLE_CHOICES`                | `300` | Multiple Choices                                              |
| `MOVED_PERMANENTLY`               | `301` | Moved Permanently: Resource moved to a new URL                |
| `FOUND`                           | `302` | Found: Resource temporarily under different URI               |
| `SEE_OTHER`                       | `303` | See Other: Redirect to another URI using GET                  |
| `NOT_MODIFIED`                    | `304` | Not Modified: Cached version is still valid                   |
| `USE_PROXY`                       | `305` | Use Proxy: Deprecated                                         |
| `TEMPORARY_REDIRECT`              | `307` | Temporary Redirect: Resource temporarily at another URI       |
| `PERMANENT_REDIRECT`              | `308` | Permanent Redirect: Resource permanently at another URI       |
| `BAD_REQUEST`                     | `400` | Bad Request: Malformed request                                |
| `UNAUTHORIZED`                    | `401` | Unauthorized: Missing or invalid auth credentials             |
| `PAYMENT_REQUIRED`                | `402` | Payment Required: Reserved for future use                     |
| `FORBIDDEN`                       | `403` | Forbidden: Authenticated but no permission                    |
| `NOT_FOUND`                       | `404` | Not Found: Resource does not exist                            |
| `METHOD_NOT_ALLOWED`              | `405` | Method Not Allowed: HTTP method not allowed                   |
| `NOT_ACCEPTABLE`                  | `406` | Not Acceptable: Response not acceptable by client             |
| `PROXY_AUTHENTICATION_REQUIRED`   | `407` | Proxy Authentication Required                                 |
| `REQUEST_TIMEOUT`                 | `408` | Request Timeout: Server timeout waiting for client            |
| `CONFLICT`                        | `409` | Conflict: Request conflict (e.g. duplicate resource)          |
| `GONE`                            | `410` | Gone: Resource is no longer available                         |
| `LENGTH_REQUIRED`                 | `411` | Length Required: Missing Content-Length header                |
| `PRECONDITION_FAILED`             | `412` | Precondition Failed                                           |
| `PAYLOAD_TOO_LARGE`               | `413` | Payload Too Large                                             |
| `URI_TOO_LONG`                    | `414` | URI Too Long                                                  |
| `UNSUPPORTED_MEDIA_TYPE`          | `415` | Unsupported Media Type                                        |
| `RANGE_NOT_SATISFIABLE`           | `416` | Range Not Satisfiable                                         |
| `EXPECTATION_FAILED`              | `417` | Expectation Failed                                            |
| `IM_A_TEAPOT`                     | `418` | I'm a teapot: Joke response for coffee machines               |
| `MISDIRECTED_REQUEST`             | `421` | Misdirected Request: Sent to the wrong server                 |
| `UNPROCESSABLE_ENTITY`            | `422` | Unprocessable Entity (WebDAV)                                 |
| `LOCKED`                          | `423` | Locked (WebDAV)                                               |
| `FAILED_DEPENDENCY`               | `424` | Failed Dependency (WebDAV)                                    |
| `TOO_EARLY`                       | `425` | Too Early: Request might be replayed                          |
| `UPGRADE_REQUIRED`                | `426` | Upgrade Required                                              |
| `PRECONDITION_REQUIRED`           | `428` | Precondition Required                                         |
| `TOO_MANY_REQUESTS`               | `429` | Too Many Requests: Rate limiting                              |
| `REQUEST_HEADER_FIELDS_TOO_LARGE` | `431` | Request Header Fields Too Large                               |
| `UNAVAILABLE_FOR_LEGAL_REASONS`   | `451` | Unavailable For Legal Reasons                                 |
| `INTERNAL_SERVER_ERROR`           | `500` | Internal Server Error: Unhandled server error                 |
| `NOT_IMPLEMENTED`                 | `501` | Not Implemented: Endpoint/method not implemented              |
| `BAD_GATEWAY`                     | `502` | Bad Gateway: Invalid response from upstream server            |
| `SERVICE_UNAVAILABLE`             | `503` | Service Unavailable: Server temporarily overloaded/down       |
| `GATEWAY_TIMEOUT`                 | `504` | Gateway Timeout: No response from upstream server             |
| `HTTP_VERSION_NOT_SUPPORTED`      | `505` | HTTP Version Not Supported                                    |
| `VARIANT_ALSO_NEGOTIATES`         | `506` | Variant Also Negotiates                                       |
| `INSUFFICIENT_STORAGE`            | `507` | Insufficient Storage (WebDAV)                                 |
| `LOOP_DETECTED`                   | `508` | Loop Detected (WebDAV)                                        |
| `NOT_EXTENDED`                    | `510` | Not Extended                                                  |
| `NETWORK_AUTHENTICATION_REQUIRED` | `511` | Network Authentication Required                               |

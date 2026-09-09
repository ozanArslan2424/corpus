# Cors

Cross-origin resource sharing.

Constructing a `Cors` attaches it to the nearest `App`, which then
calls it from two places: [App.respond](../App/index.md#app-respond) runs [Cors.handler](#cors-handler) on
every outgoing response, after the `Middleware` chain has finished, and
[App.handlePreflight](../App/index.md#app-handlepreflight) delegates to [Cors.handlePreflight](#cors-handlepreflight) for
`OPTIONS` requests carrying
[HeaderKey.AccessControlRequestMethod](../Headers/index.md#headerkey-accesscontrolrequestmethod). Running last is deliberate — a
middleware that short-circuits the chain cannot drop the CORS headers.

With no `Cors` attached, an app answers preflights with
[Status.NO_CONTENT](../Res/index.md#status-no-content) and sends no CORS headers at all.

```ts
import { Cors } from "@ozanarslan/corpus";

new Cors({ allowedOrigins: ["https://example.com"], credentials: true });
```

<section class="table-of-contents">

##### Contents

1. [Cors](#cors)
2. [CorsInterface](#corsinterface)

</section>

## Cors

_class_

```ts
class Cors implements CorsInterface
```

Default [CorsInterface](#corsinterface) implementation.

Both entry points share [Cors.applyHeaders](#cors-applyheaders), so a preflight and a real
response describe the same policy. The preflight builds a fresh
[Status.NO_CONTENT](../Res/index.md#status-no-content) `Res` — it never reaches a route handler —
while the response path writes onto the `Res` that is already being
returned.

### Cors.constructor()

```ts
constructor(public opts?: CorsOptions)
```

Creates a policy and attaches it to the nearest `App`.

**Parameters**

- `opts` — The `CorsOptions` to enforce. Omitting them yields a permissive wildcard origin with no method, header or exposure restrictions.

### Cors.register()

```ts
register(): void
```

Attaches this policy to the nearest `App`, replacing any policy
already set. Called by the constructor; an app holds exactly one.

### Cors.handler

```ts
handler: ContextHandler;
```

Adds the CORS headers to an outgoing response.

Called by [App.respond](../App/index.md#app-respond) for every response, after the handler chain
has produced its result.

**Parameters**

- `c` — The `Context` for the request, read for its `Origin` header and written to through [Context.res](../Context/index.md#context-res).

### Cors.handlePreflight

```ts
handlePreflight: ContextHandler;
```

Preflight handler for OPTIONS requests.

Answers with an empty [Status.NO_CONTENT](../Res/index.md#status-no-content) response carrying the full
policy, including [HeaderKey.AccessControlMaxAge](../Headers/index.md#headerkey-accesscontrolmaxage) so the browser can
cache the result and skip the round trip on subsequent requests.

**Parameters**

- `c` — The `Context` for the preflight request.

**Returns** — The preflight `Res`.

### Cors.applyHeaders()

```ts
protected applyHeaders(headers: Headers, reqOrigin: string, includeMaxAge = false): void
```

Applies CORS headers to a Headers object given the request origin.

Origin resolution has three outcomes. A wildcard policy sends `*`. A policy
listing origins sends the request's own origin when it is listed, and no
origin header at all when it is not — an unlisted origin is rejected by
omission rather than by an error status. A wildcard policy combined with
`credentials` reflects the request origin instead of `*`, because the spec
forbids the wildcard in credentialed mode. Whenever the origin is reflected,
[HeaderKey.Vary](../Headers/index.md#headerkey-vary) is appended so caches key on it.

The remaining list headers are written only when their option is a non-empty
array, so an unset method or header list leaves the browser's defaults
alone.

**Parameters**

- `headers` — The response headers to write into.
- `reqOrigin` — The request's `Origin` header, or an empty string when it sent none.
- `includeMaxAge` — Whether to send [HeaderKey.AccessControlMaxAge](../Headers/index.md#headerkey-accesscontrolmaxage). Set for preflights, where it governs how long the browser caches the result. Defaults to `false`.

## CorsInterface

_interface_

```ts
interface CorsInterface
```

The public shape of a CORS policy, implemented by `Cors`. This is the
type [App.cors](../App/index.md#app-cors) holds, so a custom policy only has to satisfy the
contract.

| Name              | Description                                   |
| ----------------- | --------------------------------------------- |
| `opts`            | The configured `CorsOptions`.                 |
| `handlePreflight` | Preflight handler for OPTIONS requests.       |
| `handler`         | Applies CORS headers to an outgoing response. |

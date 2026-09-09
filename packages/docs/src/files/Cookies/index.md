# Cookies

Cookie reading and writing, built on Bun's native cookie primitives.

`Cookies` extends `Bun.CookieMap`, so it keeps the whole native API —
`get`, `set`, `delete`, iteration — and adds the two constructions the
framework needs: parsing an inbound `Cookie` header and parsing outbound
`Set-Cookie` headers back into a map.

The two header formats are not interchangeable, which is why they get separate
entry points: a `Cookie` header is a list of name/value pairs on one line with
no attributes, while each `Set-Cookie` header is a single cookie carrying its
own `Path`, `Max-Age`, `HttpOnly` and the rest.

<section class="table-of-contents">

##### Contents

1. [Cookies](#cookies)
2. [parseSetCookieHeaders](#parsesetcookieheaders)

</section>

## Cookies

_class_

```ts
class Cookies extends Bun.CookieMap
```

A cookie map with header-parsing constructors.

Everything `Bun.CookieMap` offers is available unchanged; the two static
methods are the additions. Use [Cookies.fromHeader](#cookies-fromheader) for what a client
sent and [Cookies.fromSetCookieHeaders](#cookies-fromsetcookieheaders) for what a server is sending
back — reading a response's own cookies, or following them in a client.

### Cookies.constructor()

```ts
constructor(...args: ConstructorParameters<typeof Bun.CookieMap>)
```

Creates a cookie map, forwarding to the native constructor.

`Bun.CookieMap` is a native class that ignores `new.target`, so instances
come back with the base prototype and none of the subclass members attached.
The prototype is reattached here, which is what makes subclassing work at
all.

**Parameters**

- `args` — The native `Bun.CookieMap` constructor arguments.

### Cookies.fromHeader()

```ts
static fromHeader(cookieHeader: string): Cookies
```

Builds a map from an inbound `Cookie` header.

**Parameters**

- `cookieHeader` — The raw `Cookie` header value, as sent by the client.

**Returns** — The cookies it carried. Repeated names resolve to the last occurrence.

### Cookies.fromSetCookieHeaders()

```ts
static fromSetCookieHeaders(headers: string[]): Cookies
```

Builds a map from outbound `Set-Cookie` headers, preserving each cookie's
attributes.

**Parameters**

- `headers` — The raw `Set-Cookie` values, one per cookie.

**Returns** — The cookies they describe. Repeated names resolve to the last occurrence.

## parseSetCookieHeaders

_function_

```ts
function parseSetCookieHeaders(headers: string[]): Array<Bun.Cookie>;
```

Parses `Set-Cookie` header values into individual cookies, attributes
included.

Each header carries exactly one cookie, so no splitting is needed — unlike
`parseCookieHeader`, which has to break one header into many pairs.

**Parameters**

- `headers` — The raw `Set-Cookie` header values, one per cookie. Use `Headers.getSetCookie()` to obtain them; a plain `get` collapses repeated headers into one string and loses the boundaries.

**Returns** — The parsed cookies, in the order given.

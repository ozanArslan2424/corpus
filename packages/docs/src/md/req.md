# Req

Req extends the native [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) class with a cookie jar, improved headers, and a set of pre-resolved utilities. It is used throughout Corpus in place of the native Request — i.e `Context.req`.

<section class="table-of-contents">

##### Contents

1. [Constructor](#constructor)
2. [Properties](#properties)
3. [Method Enum](#method-enum)
4. [types](#types)

</section>

## Constructor

Req accepts the same arguments as the native Request: an `info` argument and an optional `init` object. On construction, all properties are resolved eagerly.

```ts
import { C } from "@ozanarslan/corpus";

const req = new C.Req("http://localhost:3000/hello?foo=bar", {
	method: "GET",
	headers: { authorizaton: "something" },
});
```

## Properties

### `urlObject`

A pre-resolved URL instance derived from the request's `info`. Avoids repeated `new URL(req.url)` calls throughout the request lifecycle. If the parsed URL has no pathname, it defaults to "/".

### `headers`

Overrides the native `headers` property with a [CHeaders](/headers.html) instance. If `init.headers` is provided, it is used directly. Otherwise, headers are inherited from the `info` argument if it is a Request or Req.

### `cookies`

A [Cookies](/cookies.html) instance (cookie jar) populated by parsing the `Cookie` request header from a native Request or using the init. Each `name=value` pair in the header is extracted and added to the jar on construction.

### `isPreflight`

A boolean that is `true` when the request is a CORS preflight — i.e. the method is `OPTIONS` and the `Access-Control-Request-Method` header is present.

### `isWebsocket`

A boolean that is `true` when the request is a WebSocket upgrade — i.e. both the `Connection: upgrade` and `Upgrade: websocket` headers are present (checked case-insensitively).

## Method Enum

Commonly used HTTP verbs.

```ts
type Method = ValueOf<typeof Method>;

const Method = {
	/* Retrieve a resource from the server */
	GET: "GET",
	/* Submit data to create a new resource */
	POST: "POST",
	/* Replace an entire resource with new data */
	PUT: "PUT",
	/* Apply partial modifications to a resource */
	PATCH: "PATCH",
	/* Remove a resource from the server */
	DELETE: "DELETE",
	/* Get response headers without body */
	HEAD: "HEAD",
	/* Discover communication options */
	OPTIONS: "OPTIONS",
	/* Establish tunnel to server */
	CONNECT: "CONNECT",
	/* Echo back received request */
	TRACE: "TRACE",
} as const;
```

## types

```ts
export type ReqInfo = Request | string | Req | URL;

export type ReqInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: HeadersInit;
	method?: Method;
};
```

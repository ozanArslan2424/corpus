---
toc:
  - title: Usage
    url: "#usage"
  - title: Parameters
    url: "#parameters"
  - title: Behavior
    url: "#behavior"
---

# resolveResBody

Normalizes an arbitrary response value into a `BodyInit`-compatible value plus the `Content-Type` that should accompany it. This is internal plumbing for building `Response` objects from whatever a route handler returns. It's not meant to be a general-purpose serialization utility.

## Usage

```ts
const [body, contentType] = resolveResBody({ id: 1, name: "Alice" });
// body: '{"id":1,"name":"Alice"}', contentType: "application/json"
```

## Parameters

### b

The value to normalize. Can be `null`/`undefined`, a primitive, or any object type the fetch `Response` API accepts (or that this function knows how to convert, like `Date`).

## Behavior

### Return value

Returns a tuple `[body, contentType]`. `contentType` is `undefined` when the input has no clear content type (e.g. `null`/`undefined`, a plain object that isn't one of the recognized types, or a `ReadableStream`) — in those cases the caller is expected to leave the header unset or supply its own.

### Type-specific handling

- `null`/`undefined` pass through unchanged with no content type.
- Primitives (string, number, boolean, etc.) are stringified with `text/plain`.
- `ArrayBuffer`, `Blob`, `FormData`, `URLSearchParams`, and `ReadableStream` are passed through with their conventional content types (a `Blob`'s own `type` is used when present).
- `Date` is converted to an ISO string with `text/plain` — not `application/json`, despite being an object.
- Anything else falls through to `JSON.stringify` with `application/json`.

---
toc:
  - title: Usage
    url: "#usage"
  - title: Parameters
    url: "#parameters"
---

# wrapCookieMap

Wraps a `Bun.CookieMap` in a `Proxy` that invokes a callback whenever the map is mutated via `set` or `delete`. This is internal plumbing used to keep a response's cookie state in sync with whatever is tracking it (e.g. re-serializing `Set-Cookie` headers) — it is not a general-purpose cookie utility and should not be reached for outside that use case.

## Usage

Only use this when you need to observe writes to a `Bun.CookieMap` that consumer code already has a reference to. If you just need to read or write cookies, use `Context.req.cookies` or `Context.res.cookies` directly — do not wrap it "just in case."

### Example

```ts
const cookies = new Bun.CookieMap();
const synced = wrapCookieMap(cookies, (map) => {
	response.headers.set("Set-Cookie", map.toSetCookieHeaders().join(", "));
});

synced.set("session", "abc123"); // triggers syncCallback
synced.delete("session"); // triggers syncCallback
synced.get("session"); // does not trigger syncCallback
```

## Parameters

### `map`

The `Bun.CookieMap` instance to wrap. All non-mutating access is transparently passed through to this instance.

### `syncCallback`

Called with the underlying (unwrapped) `map` after every `set` or `delete` call completes. Use this to react to mutations — for example, flushing headers or persisting state. It is not called for reads or for any other method.

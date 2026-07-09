# CacheControlDirective

`CacheControlDirective` describes a `Cache-Control` header as a plain object and serializes it to the header string. It is used by [StaticRoute](/route-static.html) and [BundleRoute](/route-bundle.html) for their `cache` options, and can be used directly on any `Headers` instance.

The class doubles as the type: plain object literals satisfy it, so instantiation with `new` is never required. Anywhere a `CacheControlDirective` is expected, `{ public: true, maxAge: 3600 }` works as-is.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Fields](#fields)
3. [Static Methods](#static-methods)

</section>

## Usage

### As a plain object

```ts
import { C } from "@ozanarslan/corpus";

// hashed assets, cache forever
new C.StaticRoute("/logo", {
	filePath: addr("assets", "logo-3f2a1b.svg"),
	cache: { public: true, maxAge: 31536000, immutable: true },
});

// always revalidate
new C.StaticRoute("/manifest", {
	filePath: addr("assets", "manifest.json"),
	cache: { noCache: true },
});
```

### Serializing manually

```ts
CacheControlDirective.createHeaderString({ public: true, maxAge: 3600 });
// "public, max-age=3600"

CacheControlDirective.createHeaderString({ public: true, maxAge: 31536000, immutable: true });
// "public, max-age=31536000, immutable"

CacheControlDirective.createHeaderString({ noStore: true, maxAge: 3600 });
// "no-store" (everything else is ignored)
```

### Applying to a Headers instance

```ts
CacheControlDirective.applyHeader(c.res.headers, { public: true, maxAge: 3600 });
```

## Fields

All fields are optional.

| Field       | Type      | Serialized as | Description                                                          |
| ----------- | --------- | ------------- | -------------------------------------------------------------------- |
| `noStore`   | `boolean` | `no-store`    | Response must not be stored at all. Overrides everything else.       |
| `noCache`   | `boolean` | `no-cache`    | Response must be revalidated before use. Overrides everything below. |
| `public`    | `boolean` | `public`      | Response may be stored by shared caches.                             |
| `maxAge`    | `number`  | `max-age={n}` | Freshness lifetime in seconds.                                       |
| `immutable` | `boolean` | `immutable`   | Response will never change while fresh; skips revalidation.          |

### Precedence

Serialization short-circuits in this order:

1. `noStore: true` produces `"no-store"` and ignores all other fields.
2. `noCache: true` produces `"no-cache"` and ignores all other fields.
3. Otherwise `public`, `maxAge`, and `immutable` are joined with `", "` in that order.

An object with no set fields serializes to an empty string.

## Static Methods

### createHeaderString

`createHeaderString(opts: CacheControlDirective): string`

Serializes the directive to a `Cache-Control` header value following the [precedence](#precedence) rules.

### applyHeader

`applyHeader(headers: Headers, opts: CacheControlDirective): Headers`

Serializes the directive and sets it as the `Cache-Control` header on the given `Headers` instance. Returns the same instance.

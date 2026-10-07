# @ozanarslan/corpus

## 1.0.0

### Major Changes

- **Version reset to 1.0.0.** Earlier releases in the `0.x` range were unpublished from npm, and npm permanently reserves deleted version numbers and they can never be republished. Rather than resume from an arbitrary point above that range, both packages move to `1.0.0`. This is a numbering change, not a rewrite: there is no API break associated with the bump itself.

## 0.1.0

### Minor Changes

- - - **Fix: `App.prefix` was never applied to routes.** Routes registered themselves by pushing straight onto `App.routes`, so the prefix was silently ignored and every endpoint resolved at the root. `App` now exposes `addRoute(route)`, which rewrites the route's `endpoint` through `joinPathSegments(this.prefix, route.endpoint)` before pushing it; `RouteBase.register` calls that instead of touching `routes` directly. Any app with a non-empty `prefix` will see its routes move to the intended paths.
    - `AppInterface`: add `addRoute(route)`.
    - `App.listen`: drop the per-route `withLeadingSlash(route.endpoint)` call — endpoints are now normalized at registration.
    - `utils/path`: remove `withLeadingSlash`, now unused.
    - `SchemaParser`: strip the doc comments from the inlined Standard Schema spec types — no API change.

## 0.0.4

### Patch Changes

- - `Config`: mark the class `abstract` — it is a static-only namespace and was never meant to be instantiated.
  - `Controller`: declare `beforeEach` as `Optional<ContextHandler>` instead of an optional property, so it is always present on the instance.
  - `exports`: export the `ContextHandler` type from the package root.

## 0.0.3

### Patch Changes

- remove incompatible object declaration from utils

## 0.0.2

### Patch Changes

- perf(body-parsing): skip request clone when handlers don't read c.req directly

  - ContextAccess: track req/res/url/data/server alongside body/search/params. Added reqBody to distinguish c.req.json()/text()/etc. from headers/method reads, so only genuine raw-body access forces a clone
  - App.composeRoutes: clone c.req only when access.reqBody is true, instead of always cloning inside BodyParser
  - BodyParser.parse: remove internal clone, caller now provides an already-safe-to-drain input
  - update ContextAccess and BodyParser tests to match

## 0.0.1

### Patch Changes

- First release.

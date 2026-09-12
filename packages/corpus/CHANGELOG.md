# @ozanarslan/corpus

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

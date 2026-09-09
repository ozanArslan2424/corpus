# ContextAccess

Works out which parts of a request a route actually uses, so the rest can be
skipped.

Parsing a body, a query string and path parameters costs work, and most
handlers only use one of them. Before serving a route, `App` asks this
module what the handler chain reads and then parses only that.

The answer comes from reading the handler's own source: `fn.toString()` gives
back the function's text, and every mention of the context parameter is
checked. `c.body` is a read of the body. `({ params }) => …` is a read of the
params. Anything less obvious — passing `c` to another function, returning it,
indexing it with a variable — means the handler could reach anything, so
everything gets parsed.

That fallback is the rule the whole module follows: when in doubt, parse it
all. Guessing "unused" wrongly would hand a handler an empty body it was
counting on. Guessing "used" wrongly just does some work nobody needed.

<section class="table-of-contents">

##### Contents

1. [getContextAccess](#getcontextaccess)

</section>

## getContextAccess

_function_

```ts
function getContextAccess(
	handlers: ReadonlyArray<Function>,
	config: Optional<RouteConfig>,
): ContextAccess;
```

Combines every handler in a route's chain into one answer.

A property is parsed if any handler reads it, so a `Middleware` that
needs the body still gets one even when the route handler ignores it. A key
with a schema in the route's [RouteConfig](../../RouteBase/index.md#routeconfig) is always parsed — skipping
it would let an invalid payload through unvalidated.

**Parameters**

- `handlers` — Every function in the chain, middleware and route handler alike.
- `config` — The route's config, read for its schemas.

**Returns** — Which properties `App` should populate on the `Context`.

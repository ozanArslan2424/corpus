# Middleware

Logic that runs around a route handler — before it, after it, or instead of
it.

A `Middleware` receives the `Context` and a `next` function. What
runs before `await next()` happens on the way in; what runs after it happens
on the way out, with the downstream result in hand. Returning early instead of
calling `next()` short-circuits the chain, which is how authentication rejects
a request without the route handler ever running.

Constructing one registers it on the nearest `App`, which folds it into
each targeted route's chain at compile time via `composeHandlerChain`.
Targeting is by route id, but [Middleware.useOn](#middleware-useon) accepts routes and
`Controller` instances directly and resolves the ids itself.

```ts
import { Middleware } from "@ozanarslan/corpus";

new Middleware({
	useOn: usersController,
	handler: async (c, next) => {
		const started = performance.now();
		const result = await next();
		c.res.headers.set("X-Response-Time", performance.now() - started);
		return result;
	},
});
```

<section class="table-of-contents">

##### Contents

1. [Middleware](#middleware)
2. [MiddlewareDefinition](#middlewaredefinition)
3. [MiddlewareUseOn](#middlewareuseon)
4. [MiddlewareHandler](#middlewarehandler)

</section>

## Middleware

_class_

```ts
class Middleware
```

A handler registered to run around some or all of an app's routes.

Middlewares execute in the order [App.findMiddlewares](../App/index.md#app-findmiddlewares) returns them:
global ones first, then route-specific ones, then the route handler. Since the
chain nests, a global middleware wraps everything after it — its post-`next()`
code runs last.

Targeting a route id that no route claims is not an error, but the middleware
will never run; [App.warnUnmatchedMiddlewares](../App/index.md#app-warnunmatchedmiddlewares) logs a warning at startup
when that happens.

### Middleware.constructor()

```ts
constructor();
constructor(definition: MiddlewareDefinition);
constructor(definition?: MiddlewareDefinition)
```

Creates a middleware for subclasses, which declare
[Middleware.handler](#middleware-handler) and [Middleware.useOn](#middleware-useon) as class fields and
call [Middleware.register](#middleware-register) themselves.

Creates a middleware and registers it on the nearest `App`.

**Parameters**

- `definition` — The [MiddlewareDefinition](#middlewaredefinition): the handler, and optionally what it applies to.

### Middleware.register()

```ts
register(): void
```

Registers this middleware on the nearest `App` through
[App.addMiddleware](../App/index.md#app-addmiddleware). Called by the constructor.

Registration order relative to routes does not matter — targets are resolved
to ids here, and the app only matches them when it compiles routes.

### Middleware.useOn

```ts
useOn: MiddlewareUseOn;
```

What this middleware applies to. Defaults to `"*"`, meaning every route on
the app.

### Middleware.handler

```ts
handler!: MiddlewareHandler
```

The function that runs when a targeted route is hit.

### Middleware.routeIds

```ts
get routeIds(): Array<string>
```

The route ids resolved from [Middleware.useOn](#middleware-useon), which
[App.addMiddleware](../App/index.md#app-addmiddleware) indexes the middleware under.

Each target contributes its ids: a route its own, a `Controller` all
of [Controller.routeIds](../Controller/index.md#controller-routeids), and a string itself. Duplicates are
collapsed, so a route listed both directly and through its controller is
still wrapped once.

**Returns** — The ids, or `["*"]` for a global middleware.

## MiddlewareDefinition

_type_

```ts
type MiddlewareDefinition = {
	/** What the middleware applies to. Defaults to `"*"` — every route. */ useOn?: MiddlewareUseOn;
	/** The [MiddlewareHandler](#middlewarehandler) to run. */ handler: MiddlewareHandler;
};
```

Construction arguments for a `Middleware`.

| Name      | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `useOn`   | What the middleware applies to. Defaults to `"*"` — every route. |
| `handler` | The [MiddlewareHandler](#middlewarehandler) to run.              |

## MiddlewareUseOn

_type_

```ts
type MiddlewareUseOn =
	Array<RouteBase | Controller | string> | RouteBase | Controller | OrString<"*">;
```

What a middleware applies to.

A `RouteBase` targets that route, a `Controller` targets every
route registered through it, a string targets a route id directly, and an
array combines any of these. The literal `"*"` targets every route on the app,
including requests that match none — global middlewares also run ahead of
[App.handleNotFound](../App/index.md#app-handlenotfound).

## MiddlewareHandler

_type_

```ts
type MiddlewareHandler<R = unknown> = (
	context: Context,
	next: () => MaybePromise<R>,
) => MaybePromise<R>;
```

A middleware's handler function. Like a [ContextHandler](../Context/index.md#contexthandler), but with the
rest of the chain passed in.

What the return value means is resolved by `composeHandlerChain`: a
returned value short-circuits the chain, `undefined` after calling `next()`
passes the downstream result through, and `undefined` without calling `next()`
lets the chain continue anyway.

**Type parameters**

- `R` — The result type passed along the chain.

**Parameters**

- `context` — The `Context` for the request, shared with every other handler in the chain. Use [Context.data](../Context/index.md#context-data) to pass state downstream.
- `next` — Runs the rest of the chain and resolves to its result. Calling it more than once throws.

**Returns** — The response value, or `undefined` to defer to the chain.

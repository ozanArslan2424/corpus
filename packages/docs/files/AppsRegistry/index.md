# AppsRegistry

Process-wide registry of every [`AppInterface`](../App/index.md#appinterface) instance that has been
constructed.

The registry is what lets `RouteBase` implementations and
`Middleware` attach themselves without being handed an app: they call
[`getNearestApp`](#getnearestapp) and find the most recently constructed one. The array
lives on `Globals`, so it survives module re-evaluation and is shared
across the whole process.

## AppsRegistry

_type_

```ts
type AppsRegistry = Array<AppInterface>;
```

The registry itself: every [`AppInterface`](../App/index.md#appinterface) in construction order, oldest
first. The last entry is the one [`getNearestApp`](#getnearestapp) resolves to.

## getOrInitAppsRegistry

_function_

```ts
function getOrInitAppsRegistry(): AppsRegistry;
```

Reads the registry from `Globals`, creating an empty one on first
access.

**Returns** — The shared `AppsRegistry`. The array is live — mutating it mutates the registry.

## getNearestApp

_function_

```ts
function getNearestApp(): AppInterface;
```

Resolves the [`AppInterface`](../App/index.md#appinterface) that newly constructed routes and
middlewares should attach to: the most recently registered one.

With a single app — the common case — this is simply that app. With several,
"nearest" means last constructed, so an app must be instantiated before the
routes belonging to it.

**Returns** — The most recently registered [`AppInterface`](../App/index.md#appinterface).

**Throws** — `Error` when no app has been constructed yet.

## registerApp

_function_

```ts
function registerApp(app: AppInterface): void;
```

Appends an app to the registry, making it the one [`getNearestApp`](#getnearestapp)
returns. Called by the `App` constructor; there is no reason to call it
by hand.

**Parameters**

- `app` — The [`AppInterface`](../App/index.md#appinterface) to register.

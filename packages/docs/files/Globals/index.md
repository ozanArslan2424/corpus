# Globals

Typed process-wide state, stored on `globalThis` under package-namespaced
symbols.

Two things in the framework must be singletons regardless of how many times
the module is evaluated: the `AppsRegistry` that [`getNearestApp`](../AppsRegistry/index.md#getnearestapp)
resolves against, and the `ParsersRegistry` that every route reads while
compiling. Module-level variables cannot guarantee that — a duplicated
dependency, a re-import under a different resolution, or a test runner
reloading modules each produces a second copy, and two apps registries means
routes registering onto an app that is never served.

The keys are `Symbol.for("@ozanarslan/corpus:<key>")`, so they are shared
across every copy of the package in the process and cannot collide with
another library's globals.

## GlobalRegistry

_interface_

```ts
interface GlobalRegistry
```

What lives in the global store, and the type of each entry. Adding a key here
requires a matching entry in [`GLOBAL_SYMBOLS`](#global-symbols), which the `satisfies`
clause enforces.

| Name          | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `initialized` | Whether one-time framework setup has run.                                  |
| `apps`        | The shared `AppsRegistry` — every `App` constructed in this process.       |
| `parsers`     | The shared `ParsersRegistry` — the parsers routes resolve at compile time. |

## Globals

_class_

```ts
class Globals
```

Typed accessor for the global store.

Keys are constrained to [`GlobalRegistry`](#globalregistry), so every read and write is
checked against the type declared for that entry.

### Globals.getSymbol()

```ts
static getSymbol<K extends keyof GlobalRegistry>(key: K):(typeof GLOBAL_SYMBOLS)[K]
```

Returns the symbol an entry is stored under.

Useful for inspecting or clearing global state directly — in a test that
needs a clean process, for instance.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.

**Returns** — Its symbol from [`GLOBAL_SYMBOLS`](#global-symbols).

### Globals.create()

```ts
static create<K extends keyof GlobalRegistry>(key: K, init:()=>GlobalRegistry[K], ): GlobalRegistry[K]
```

Reads an entry, creating it on first access.

The initialiser runs only when the entry is absent, which is what makes this
safe to call from anywhere: the first caller creates the value and every
later one gets that same instance. This is how
[`getOrInitAppsRegistry`](../AppsRegistry/index.md#getorinitappsregistry) and [`getOrInitParsersRegistry`](../ParsersRegistry/index.md#getorinitparsersregistry) work.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.
- `init` — Builds the initial value. Not called if the entry exists.

**Returns** — The stored value.

### Globals.get()

```ts
static get<K extends keyof GlobalRegistry>(key: K): GlobalRegistry[K]
```

Reads an entry that is expected to exist.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.

**Returns** — The stored value.

**Throws** — `Error` when the entry has not been created. Use [`Globals.create`](#globals-create) when the caller may be the first.

### Globals.set()

```ts
static set<K extends keyof GlobalRegistry>(key: K, value: GlobalRegistry[K]): void
```

Writes an entry, replacing any existing value.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.
- `value` — The value to store.

### Globals.has()

```ts
static has<K extends keyof GlobalRegistry>(key: K): boolean
```

Reports whether an entry has been created, without creating it or throwing.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.

**Returns** — `true` when the entry exists.

### Globals.delete()

```ts
static delete<K extends keyof GlobalRegistry>(key: K): void
```

Removes an entry, so the next [`Globals.create`](#globals-create) rebuilds it from
scratch. Mainly useful for resetting state between tests.

**Parameters**

- `key` — The [`GlobalRegistry`](#globalregistry) entry.

## GLOBAL_SYMBOLS

_const_

```ts
const GLOBAL_SYMBOLS;
```

The symbol for each [`GlobalRegistry`](#globalregistry) entry.

Registered through `Symbol.for`, so every copy of the package in the process
resolves to the same symbol and therefore to the same stored value.

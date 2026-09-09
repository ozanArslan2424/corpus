# Config

Typed access to environment variables and the current runtime environment.

`Config` is a static façade over `process.env` — nothing is cached, so a
read always reflects the current value. Beyond convenience, it is what the
framework itself consults for environment-dependent behaviour: `App`
checks [Config.nodeEnv](#config-nodeenv) before exiting the process on
[App.close](../App/index.md#app-close).

Declare your variables on [Env](#env) in your own code to get autocompletion
and a checked key for every lookup.

```ts
const port = Config.get("PORT", { parser: Number, fallback: 3000 });
const secret = Config.require("JWT_SECRET");
```

<section class="table-of-contents">

##### Contents

1. [Config](#config)
2. [Env](#env)

</section>

## Config

_class_

```ts
class Config
```

Static accessor for environment variables.

Every read goes straight to `process.env`, so a variable set after startup —
by a test, or by [Config.set](#config-set) — is visible immediately.

The three lookups differ in how they treat a missing value:
[Config.get](#config-get) returns `undefined` or a fallback, [Config.require](#config-require)
throws, and [Config.has](#config-has) only reports presence.

### Config.env

```ts
static get env(): NodeJS.ProcessEnv
```

The live `process.env` object.

**Returns** — The environment, unwrapped. Reading it directly bypasses the parsing and fallback handling of [Config.get](#config-get).

### Config.nodeEnv

```ts
static get nodeEnv(): NodeEnv
```

The current environment name.

**Returns** — The value of `NODE_ENV`, or `"development"` when it is unset — an unconfigured process is treated as a development one.

### Config.isProd

```ts
static get isProd(): boolean
```

**Returns** — `true` when [Config.nodeEnv](#config-nodeenv) is `"production"`.

### Config.isDev

```ts
static get isDev(): boolean
```

**Returns** — `true` when [Config.nodeEnv](#config-nodeenv) is `"development"`, including when `NODE_ENV` is unset.

### Config.isTest

```ts
static get isTest(): boolean
```

**Returns** — `true` when [Config.nodeEnv](#config-nodeenv) is `"test"`. [App.close](../App/index.md#app-close) checks this to avoid exiting the process out from under a test runner.

### Config.has()

```ts
static has(key: EnvKey): boolean
```

Reports whether a variable is set, without reading its value.

**Parameters**

- `key` — The variable name to check.

**Returns** — `true` when the variable is defined. An empty string counts as defined.

### Config.get()

```ts
static get(key: EnvKey): string | undefined;
static get<T = string>(key: EnvKey, opts: { parser?:(raw: string)=>T; fallback: T }): T;
static get<T = string>(key: EnvKey, opts: { parser:(raw: string)=>T; fallback?: T }, ): T | undefined;
static get<T = string>(key: EnvKey, opts?: { parser?:(raw: string)=>T; fallback?: T }, ): T | undefined
```

Reads a variable as a raw string.

Reads a variable with a guaranteed result, since a fallback covers the unset
case.

Reads and converts a variable with no fallback.

**Parameters**

- `key` — The variable name to read.

**Returns** — The value, or `undefined` when unset.

### Config.require()

```ts
static require(key: EnvKey): string;
static require<T = string>(key: EnvKey, parser:(raw: string)=>T): T;
static require<T = string>(key: EnvKey, parser?:(raw: string)=>T): T | string
```

Reads a variable that the application cannot run without.

Reads and converts a variable that the application cannot run without.

**Parameters**

- `key` — The variable name to read.

**Returns** — The raw value.

**Throws** — `Error` when the variable is unset.

**Throws** — `Error` when the variable is unset. The parser is never called in that case, so it can assume a real value.

### Config.set()

```ts
static set(key: string, value: string | number | boolean): void
```

Writes a variable into the environment, stringifying the value the way the
environment stores everything.

Mutates the real `process.env`, so the change is visible to every reader in
the process, not only to `Config`.

**Parameters**

- `key` — The variable name to write.
- `value` — The value to store; numbers and booleans are converted to their string form.

## Env

_interface_

```ts
interface Env
```

Declaration target for an application's environment variables.

Empty by design. Augment it from your own code and every key you add becomes a
suggested `EnvKey`:

```ts
declare module "corpus" {
	interface Env {
		DATABASE_URL: string;
		JWT_SECRET: string;
	}
}
```

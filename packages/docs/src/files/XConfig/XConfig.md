# XConfig

The `XConfig` class provides a typed interface for environment variable access with parsing, fallbacks, and existence checks. It exposes convenience getters for the current `NODE_ENV` and offers a `require` method for fail-fast validation of mandatory variables at boot time.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Static properties](#static-properties)
3. [Static methods](#static-methods)

</section>

## Usage

### Reading environment variables

```ts
import { X } from "@ozanarslan/corpus";

const dbUrl = X.Config.get("DATABASE_URL");
const apiKey = X.Config.get("API_KEY", { fallback: "dev-key" });
```

### Parsing typed values

```ts
const port = X.Config.get("PORT", {
	parser: (raw) => Number.parseInt(raw, 10),
	fallback: 3000,
});

const debug = X.Config.get("DEBUG", {
	parser: (raw) => raw === "true",
	fallback: false,
});
```

### Requiring values at boot

```ts
const dbUrl = X.Config.require("DATABASE_URL");
const port = X.Config.require("PORT", Number);
```

### Environment checks

```ts
if (X.Config.isProd) {
	// Production-only logic
}

if (X.Config.has("FEATURE_FLAG")) {
	// Conditionally enable a feature
}
```

### Setting values at runtime

```ts
X.Config.set("FEATURE_FLAG", true);
X.Config.set("RETRY_COUNT", 3);
```

## Static properties

| Property | Type                                      | Description                                                             |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| env      | `NodeJS.ProcessEnv`                       | The platform's environment variable object.                             |
| nodeEnv  | `"development" \| "production" \| "test"` | The current `NODE_ENV` value, defaulting to `"development"` when unset. |
| isProd   | `boolean`                                 | True when `nodeEnv` equals `"production"`.                              |
| isDev    | `boolean`                                 | True when `nodeEnv` equals `"development"`.                             |
| isTest   | `boolean`                                 | True when `nodeEnv` equals `"test"`.                                    |

## Static methods

### has

`has(key): boolean`

Checks whether an environment variable is defined and non-empty.

#### Parameters

- `key` `string` — The environment variable name. Typed against the `Env` interface for autocomplete.

```ts
if (X.Config.has("REDIS_URL")) {
	// Connect to Redis
}
```

### get

`get<T = string>(key, opts?): T | undefined`

Reads an environment variable with optional parsing and fallback. The return type narrows based on the options provided:

- Called with no options, returns `string | undefined`.
- Called with `fallback`, returns `T`.
- Called with `parser` only, returns `T | undefined`.

When both `parser` and `fallback` are provided, the parser is applied to the raw value if present; otherwise the fallback is returned as-is without parsing.

#### Parameters

- `key` `string` — The environment variable name. Typed against the `Env` interface for autocomplete.
- `opts.parser` (optional) `(raw: string) => T` — Function to transform the raw string into the target type.
- `opts.fallback` (optional) `T` — Value to return when the key is undefined. Passing `fallback: undefined` explicitly is treated as a provided fallback.

```ts
const url = X.Config.get("DATABASE_URL");

const port = X.Config.get("PORT", {
	parser: (raw) => Number.parseInt(raw, 10),
	fallback: 3000,
});

const maybeNumber = X.Config.get("OPTIONAL_PORT", { parser: Number });
```

### require

`require<T = string>(key, parser?): T`

Reads an environment variable and throws if it is not defined. Use this for variables that must exist for the application to function correctly.

#### Parameters

- `key` `string` — The environment variable name. Typed against the `Env` interface for autocomplete.
- `parser` (optional) `(raw: string) => T` — Function to transform the raw string into the target type.

#### Throws

Throws an `Error` when the key is not defined in the environment.

```ts
const dbUrl = X.Config.require("DATABASE_URL");
const port = X.Config.require("PORT", Number);
```

### set

`set(key, value): void`

Writes a value to the environment. Numbers and booleans are coerced to their string representations via `String(value)`.

#### Parameters

- `key` `string` — The environment variable name.
- `value` `string | number | boolean` — The value to store.

```ts
X.Config.set("LOG_LEVEL", "debug");
X.Config.set("MAX_CONNECTIONS", 100);
X.Config.set("DEBUG_MODE", true);
```

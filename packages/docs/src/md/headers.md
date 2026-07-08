# Headers

Corpus augments the standard web `Headers` prototype globally with quality-of-life extensions: array appends, value coercion, case-insensitive lookups, bulk sets, and merging. There is no wrapper class. Every `Headers` instance (including `c.res.headers` and `c.req.headers`) gets these behaviors, and the standard API remains fully intact.

The augmentation is applied when Corpus is loaded. No import or setup is needed in user code.

Header names are typed as `HeaderKey` for autocomplete on known headers.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Modified Methods](#modified-methods)
3. [Added Methods](#added-methods)
4. [types](#types)

</section>

## Usage

### Coerced values

```ts
const headers = new Headers();

// numbers and booleans are stringified automatically
headers.set("content-length", 1024);
headers.set("x-cache-hit", true);
```

### Appending multiple values

```ts
const headers = new Headers();

// each array item is appended separately
headers.append("set-cookie", ["a=1; Path=/", "b=2; Path=/"]);
```

### Bulk set

```ts
const headers = new Headers();

headers.setMany({
	"cache-control": "no-cache",
	"x-request-id": requestId,
	// empty and whitespace-only values are skipped
	"x-optional": maybeValue ?? "",
});

// entries form also works
headers.setMany([
	["cache-control", "no-cache"],
	["x-request-id", requestId],
]);
```

### Merging two Headers instances

```ts
// copy everything from source into target
// Set-Cookie values are appended, everything else overwrites
target.mergeWith(source);
```

## Modified Methods

These override the standard `Headers` methods. Standard behavior is preserved; only the signatures are widened.

### append

`append(name: HeaderKey, value: string | string[]): void`

Standard append, but also accepts an array. Each array item is appended as a separate call, which matters for headers like `Set-Cookie` where values must not be combined.

### set

`set(name: HeaderKey, value: string | number | boolean): void`

Standard set, but the value is coerced with `String()`, so numbers and booleans can be passed directly.

### get

`get(name: HeaderKey): string | null`

Standard get, retried with the lowercased name if the first lookup returns nothing.

### has

`has(name: HeaderKey): boolean`

Standard has, retried with the lowercased name if the first lookup is false.

### delete

`delete(name: HeaderKey): void`

Standard delete, retyped to `HeaderKey`. Behavior is unchanged.

## Added Methods

### setMany

`setMany(init: [HeaderKey, string][] | Partial<Record<HeaderKey, string>>): void`

Sets multiple headers at once from an entries array or a record. Values that are empty or whitespace-only are skipped, so conditionally built records don't need manual filtering. Each entry is a `set`, not an `append`, so existing values are overwritten.

```ts
headers.setMany({
	"content-type": "application/json",
	"x-trace-id": trace ?? "", // skipped when empty
});
```

### mergeWith

`mergeWith(source: Headers): void`

Copies all headers from `source` into this instance.

| Header          | Behavior                                          |
| --------------- | ------------------------------------------------- |
| `Set-Cookie`    | Appended, so cookies from both instances are kept |
| Everything else | Overwritten with the value from `source`          |

```ts
const base = new Headers({ "x-a": "1", "x-b": "2" });
const extra = new Headers({ "x-b": "override" });
extra.append("set-cookie", "session=abc; Path=/");

base.mergeWith(extra);
// x-a: 1
// x-b: override
// set-cookie: session=abc; Path=/
```

## types

```ts
declare global {
	interface Headers {
		append(name: HeaderKey, value: string | string[]): void;
		set(name: HeaderKey, value: string | number | boolean): void;
		get(name: HeaderKey): string | null;
		has(name: HeaderKey): boolean;
		delete(name: HeaderKey): void;
		setMany(init: [HeaderKey, string][] | Partial<Record<HeaderKey, string>>): void;
		mergeWith(source: Headers): void;
	}
}
```

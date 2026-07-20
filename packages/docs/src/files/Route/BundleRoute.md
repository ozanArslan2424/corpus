# BundleRoute

The `BundleRoute` class serves an entire directory of built client assets (a Vite `dist` folder, a compiled docs site, any SPA bundle) from a single route with automatic registration to the global router. It resolves request paths against the directory, falls back to `index.html` for client-side routes, and applies a per-category caching strategy out of the box.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Resolution Behavior](#resolution-behavior)
3. [Caching](#caching)
4. [Constructor Parameters](#constructor-parameters)
5. [Properties](#properties)

</section>

## Usage

Routes can be instantiated directly with `new`. The constructor automatically registers the route to the global router store.

### Serving a bundle

```ts
import { C } from "@ozanarslan/corpus";

// serve the built app from the root
new C.BundleRoute("/*", "./dist");
```

### Custom cache config

Passing `cache` replaces the entire default config, it is not merged. `indexHtml` and `assetsDir` are required, `fallback` is optional.

```ts
import { C } from "@ozanarslan/corpus";

new C.BundleRoute("/*", "./dist", {
	indexHtml: { noCache: true },
	assetsDir: { public: true, maxAge: 31536000, immutable: true },
	fallback: { public: true, noCache: true },
});
```

### Extending the abstract class

Extend to override the protected members: ignore patterns, the assets directory name, or the not-found behavior.

```ts
class MyBundle extends C.BundleRouteAbstract {
	constructor() {
		super();
		// this method needs to be called to register it to the router
		// here or where you instantiate
		this.register();
	}

	override endpoint: string = "/*";
	override dir: string = "./dist";
	// optional overrides:
	protected override ignore: string[] = ["secret.json", "internal/*"];
	protected override assetsDir: string = "static";
	protected override onFileNotFound = (subPath: string) => {
		throw new C.Exception(`${subPath} not found`, C.Status.NOT_FOUND);
	};
}
```

## Resolution Behavior

For each request, in order:

1. The endpoint prefix is stripped from `c.url.pathname`; the remainder is the sub-path. An empty sub-path or `/` resolves to `index.html`.
2. The sub-path is checked against the `ignore` patterns. A pattern ending in `*` matches as a prefix, anything else matches exactly (with or without a leading slash). Ignored paths call `onIgnore`, which returns a 404 by default.
3. The sub-path is joined with `dir` and checked for existence.
4. If the file does not exist and the requested path is not an `.html` file, `index.html` is served instead. This is the SPA fallback: client-side routes like `/settings/profile` reach the app shell.
5. If nothing matches, `onFileNotFound` runs and throws a 404 `Exception` by default.

`.html` files are served as standard file responses. Everything else is streamed from disk with `inline` disposition.

## Caching

Each served file gets a `Cache-Control` header from one of three categories:

| Category    | Matches                                        | Default directive                                     | Reasoning                                                                  |
| ----------- | ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `indexHtml` | `index.html`                                   | `{ noCache: true }`                                   | Must be revalidated every time so new deploys are picked up.               |
| `assetsDir` | Files inside the assets directory (`/assets/`) | `{ public: true, maxAge: 31536000, immutable: true }` | Bundler output is content-hashed (`index-HASH.js`), safe to cache forever. |
| `fallback`  | Everything else (favicon, robots.txt, etc.)    | `{ public: true, noCache: true }`                     | Root files usually aren't hashed, so the browser should revalidate.        |

The assets directory name is `"assets"` by default and can be changed via the protected `assetsDir` property. See [CacheControlDirective](/Headers/CacheControlDirective.html) for the directive fields.

## Constructor Parameters

### path

`E extends string`

The URL endpoint pattern, e.g. `/*`. Always uses `GET` method.

### dir

`string`

The directory containing the bundle. Resolved paths are joined against it.

### cache (optional)

`BundleRouteCacheConfig`

Replaces the default cache config entirely when provided.

```ts
type BundleRouteCacheConfig = {
	/** Strategy for index.html */
	indexHtml: CacheControlDirective;
	/** Strategy for the assets folder */
	assetsDir: CacheControlDirective;
	/** Optional: Strategy for other root files (favicon, robots.txt, etc.) */
	fallback?: CacheControlDirective;
};
```

## Properties

| Property         | Type                                                     | Description                                                                  |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `id`             | `string`                                                 | Unique route identifier (`{METHOD} {endpoint}`)                              |
| `method`         | `Method`                                                 | Fixed to `Method.GET`                                                        |
| `endpoint`       | `E`                                                      | The endpoint pattern                                                         |
| `dir`            | `string`                                                 | The bundle directory                                                         |
| `handler`        | `Func`                                                   | Resolves and serves files per the rules above                                |
| `model`          | `RouteModel \| undefined`                                | Validation model if provided                                                 |
| `variant`        | `RouteVariant.bundle`                                    | Fixed to `bundle` for this class                                             |
| `cache`          | `BundleRouteCacheConfig` (protected)                     | Per-category caching strategies                                              |
| `assetsDir`      | `string` (protected)                                     | Assets directory name for cache matching, defaults to `"assets"`             |
| `ignore`         | `string[]` (protected)                                   | Sub-paths to refuse; exact match or trailing-`*` prefix match                |
| `onIgnore`       | `Func<[], MaybePromise<Res>>` (protected)                | Called for ignored paths; returns 404 by default                             |
| `onFileNotFound` | `Func<[subPath: string], MaybePromise<Res>>` (protected) | Override to change file-not-found behavior; default throws a 404 `Exception` |

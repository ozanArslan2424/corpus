# StaticRoute

The `StaticRoute` class defines a route that serves a static file with automatic registration to the global router. It accepts an address (defaults to `GET`, but any HTTP method can be set) and a file definition (either a plain file path string, or an object with `disposition` to stream the file from disk and/or `cache` to override the default caching directive). An optional custom handler can intercept file content before sending to modify the response or transform the content.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)

</section>

## Usage

Routes can be instantiated directly with `new`. The constructor automatically registers the route to the global router store.

### Simple file serve

```ts
import { C, X } from "@ozanarslan/corpus";

function addr(...path: string[]) {
	return X.Config.resolvePath(X.Config.cwd(), ...path);
}

// GET /style serves assets/style.css
new C.StaticRoute("/style", addr("assets", "style.css"));
```

### Streaming large files

Setting a `disposition` streams the file directly from disk instead of loading it into memory. Use `"inline"` to render in the browser (video, PDF preview) or `"attachment"` to force a download.

```ts
import { C } from "@ozanarslan/corpus";

// Stream video directly from disk, rendered in the browser
new C.StaticRoute("/video", {
	filePath: addr("assets", "video.mp4"),
	disposition: "inline",
});

// Stream a file as a download
new C.StaticRoute("/report", {
	filePath: addr("assets", "report.pdf"),
	disposition: "attachment",
});
```

### Using other HTTP methods

Static routes default to `GET`, but the address accepts any method via the `"VERB /path"` string form or the object form, same as [Route](/route.html).

```ts
import { C } from "@ozanarslan/corpus";

// POST /render serves the file only on POST
new C.StaticRoute("POST /render", addr("assets", "template.html"));

// object form
new C.StaticRoute({ method: C.Method.POST, path: "/render" }, addr("assets", "template.html"));
```

### Custom caching

The default `Cache-Control` directive is `{ public: true, maxAge: 3600, noCache: false }`. Pass `cache` to override it.

```ts
import { C } from "@ozanarslan/corpus";

new C.StaticRoute("/manifest", {
	filePath: addr("assets", "manifest.json"),
	cache: { public: true, noCache: true },
});
```

### Custom handler

When a handler is provided, the file content is read fully into memory as a string and passed to it, so streaming does not apply. `Content-Type`, `Content-Length`, and `Cache-Control` headers are set on `c.res` before the handler runs, so the handler can override them.

```ts
import { C } from "@ozanarslan/corpus";

// Modify response and content before sending
new C.StaticRoute("/doc", addr("assets", "doc.txt"), (c, content) => {
	c.res.headers.set("x-custom", "value");
	return content.replaceAll("hello", "world");
});
```

### Extending the abstract class

I wouldn't recommend extending since the model parsing basically becomes useless.

```ts
class MyRoute extends C.StaticRouteAbstract {
	constructor() {
		super();
		// this method needs to be called to register it to the router
		// here or where you instantiate
		this.register();
	}

	override endpoint: string = "/extended";
	override filePath: string = addr("assets", "doc.txt");
	// optional overrides:
	protected override disposition?: "attachment" | "inline" | undefined = undefined;
	protected override cache: CacheControlDirective = { public: true, maxAge: 3600, noCache: false };
	protected override callback = (c: C.Context, content: string) => content;
}
```

## Constructor Parameters

### address

`RouteAddress<E>`

The route address. A plain path string defaults to `GET`. Other methods can be set with the `"VERB /path"` string form or the object form, same as [Route](/route.html).

### definition

`StaticRouteDefinition`

The file definition. If a string is provided, serves the file normally as a standard file response. Use the object form to stream from disk (`disposition`) or override caching (`cache`).

```ts
type StaticRouteDefinition =
	// just the file path, doesn't stream
	| string
	| {
			filePath: string;
			disposition?: "attachment" | "inline";
			cache?: CacheControlDirective;
	  };
```

| Value                                                            | Behavior                                      |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `"assets/style.css"`                                             | Standard file response                        |
| `{ filePath: "assets/video.mp4", disposition: "inline" }`        | Streams file from disk, rendered in browser   |
| `{ filePath: "assets/report.pdf", disposition: "attachment" }`   | Streams file from disk as a download          |
| `{ filePath: "assets/manifest.json", cache: { noCache: true } }` | Standard response with custom `Cache-Control` |

### handler (optional)

`(context: Context<B, S, P, StaticRouteRes>, content: string) => MaybePromise<StaticRouteRes>`

Optional custom handler to intercept file content before sending. Receives the context and file content as string. Use `c.res.headers` to modify response headers. Must return a string or a `Res`.

```ts
(c, content) => {
	c.res.headers.set("x-custom", "value");
	return content; // or return new C.Res(...)
};
```

### model (optional)

`RouteModel<B, S, P, StaticRouteRes>`

Optional validation model. The response type is fixed to `StaticRouteRes` (`Res | string`). See [Model](/model.html). You can pass generics if you don't want to bother with validation but still typecast your data: `StaticRoute<B, S, P, E>`

```ts
// type Schema is any standard schema library validator.
type RouteModel<B = unknown, S = unknown, P = unknown, R = unknown> = {
	response?: Schema<R>;
	body?: Schema<B>;
	search?: Schema<S>;
	params?: Schema<P>;
};
```

## Properties

All constructor options are stored as properties after resolve methods:

| Property         | Type                                                                     | Description                                                                  |
| ---------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `id`             | `string`                                                                 | Unique route identifier (`{METHOD} {endpoint}`)                              |
| `method`         | `Method`                                                                 | Resolved from the address, defaults to `GET`                                 |
| `endpoint`       | `E`                                                                      | Resolved path                                                                |
| `handler`        | `Func<[Context<B, S, P, StaticRouteRes>], MaybePromise<StaticRouteRes>>` | Getter that builds the file-serving handler (standard, streamed, or custom)  |
| `model`          | `RouteModel \| undefined`                                                | Validation model if provided                                                 |
| `variant`        | `RouteVariant.static`                                                    | Fixed to `static` for this class                                             |
| `callback`       | `Func \| undefined` (protected)                                          | Optional content-intercepting handler                                        |
| `disposition`    | `"attachment" \| "inline" \| undefined` (protected)                      | When set, the file is streamed with this `Content-Disposition`               |
| `cache`          | `CacheControlDirective` (protected)                                      | Defaults to `{ public: true, maxAge: 3600, noCache: false }`                 |
| `onFileNotFound` | `Func<[], Promise<Res>>` (protected)                                     | Override to change file-not-found behavior; default throws a 404 `Exception` |

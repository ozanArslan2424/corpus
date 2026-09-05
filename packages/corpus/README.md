# Corpus

A simple typescript backend framework package to use for personal projects or simple crud applications.
This package is by no means a replacement for full fledged backend frameworks commonly used in production.

[Documentation](https://corpus-docs.fly.dev/)

## Quick Start

Install the package:

```bash
bun add @ozanarslan/corpus
```

```bash
npm install @ozanarslan/corpus
```

Create a simple server:

```typescript
import { C } from "@ozanarslan/corpus";

// Initialize server
const server = new C.Server();

// Add a route
new C.Route("/health", () => "ok");

// Start listening
server.listen(3000);
```

That's it. Your barebones backend is running.

## What does this library do?

- Registering routes using `Route` or `Controller`
- Registering static pages using `StaticRoute` or `Controller`
- Registering middlewares using `Middleware`
- Request data validation based on libraries using Standard Schema (e.g. arktype and zod)
- Request handling using `RouteContext` (the `(c) => {}` callback pattern)
- Loading env variables using `Config`
- Other utilities such as setting cors, global prefix, error handling etc.
- The package exports two modules: `C` (default) for the core API, and `X` - also importable as `Extra` - for additional utilities like Cors, router adapters etc.

## How does the routing work?

- Routes, route models and middlewares are lazily registered to their respective registries on class initialization. Router uses the registries and is created with the Server object. The Server should be created before any route, controller or middleware.
- Router is RegExp based and supports route parameters.
- Router supports drop-in replacements with the provided adapters as the default router is quite simple.

## Runtime?

Bun only for now, Node support planned. This is due to lack of testing, if you can get it working with node using the existing internal classes like ServerUsingBun etc. you are free to!

## Recommended Pattern

```typescript
// Any schema library that supports standard schema works
import { type } from "arktype";
// You can import The main module C by name or as a default,
// X is the Extra module and can also be imported as "Extra"
import C, { X } from "@ozanarslan/corpus";

// You can use schemas however you want, I just really like this.
export class ItemModel {
	static entity = type({
		id: "number",
		createdAt: "string.date.iso",
		name: "string",
	});
	static create = {
		body: this.entity.omit("id", "createdAt"),
	};
}

// This helper type could also work for similar prototypes
export type ItemType = X.InferModel<typeof ItemModel>;

// Repository layer isn't included.
export class ItemRepository {
	// ...
}

// Service layer isn't included.
export class ItemService {
	constructor(private readonly repo: ItemRepository) {}

	create(body: ItemType["create"]["body"]) {
		// ...
	}
}

// Controller is an abstract class
export class ItemController extends C.Controller {
	constructor(private readonly service: ItemService) {
		super({ prefix: "/item" });
	}

	// Helper instead of new Route()
	create = this.route(
		{ method: "POST", path: "/create" },
		(c) => this.service.create(c.body),
		ItemModel.create,
	);

	// Static routes can also be in the controller instead of new StaticRoute()
	page = this.staticRoute(...)
}

// Server must be created first for the router
const server = new C.Server({
    // There are some supported adapters for the router,
    // The default router with no dependencies is very simple
    // so I wanted to make it drop-in replaceable.
    adapter: new X.SomeSupportedRouterAdapter()
});
// This DOES NOT apply to static routes
server.setGlobalPrefix("/api");

// Cors headers are applied globally if you set them this way also
// any request with Access-Control-Request-Method header and OPTIONS
// method is handled as a preflight request.
new C.Cors({})

const db = new DatabaseClient();
server.setOnBeforeListen(() => db.connect());
server.setOnBeforeExit(() => db.disconnect());

// There isn't any automatic dependency injection because i don't like it,
// you can create your objects in whatever order you like
const itemRepository = new ItemRepository(db);
const itemService = new ItemService(itemRepository);
new ItemController(itemService);
new C.Route("/health", () => "ok");

// Config is a helper with a couple of methods for paths and vars.
server.listen(
	C.Config.get("PORT", { parser: parseInt, fallback: 3000 }),
	"0.0.0.0",
);
```

## What interfaces can be extended

```typescript
declare module "@ozanarslan/corpus" {
	// process.env basically
	interface Env {}

	// Any data assigned to c.data anywhere
	interface ContextDataInterface {}
}
```

# Closing thoughts

As I mentioned multiple times, this is not for production. It's also my first ever personal project at this scale. I am open to suggestions (maybe even pull requests). Thank you for being here.

Very much inspired from the core ideas behind [Elysia](https://github.com/elysiajs/elysia)

# Roadmap

- [x] Better and more memory efficient router
- [x] Reduce dist size
- [x] Support additional response body types (ArrayBuffer, Blob, FormData, etc.) in the custom Response object.
- [x] Support WebSocket
- [x] [Documentation](https://corpus-docs.fly.dev/)
- [ ] Better static routing.

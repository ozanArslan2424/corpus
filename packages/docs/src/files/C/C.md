# Introduction

**Corpus** is a lightweight TypeScript backend framework for personal projects and simple CRUD applications. It's not a production framework—it's built for when you want structure without complexity.

<section class="table-of-contents">
 
##### Contents
1. [What is Corpus?](#what-is-corpus)
2. [Core Building Blocks](#core-building-blocks)
3. [The Recommended Pattern](#the-recommended-pattern)
4. [What You Get](#what-you-get)
5. [What You Dont Get](#what-you-dont-get-and-thats-okay)
6. [Extensibility](#extensibility)
7. [What is a Func?](#what-is-a-func)
 
</section>

## What is Corpus?

Corpus gives you routing, middleware, schema validation, and utilities organized into clean patterns. It's minimal enough to understand completely, but opinionated enough to keep your code organized.

The core idea: **use standard schema libraries** (arktype, zod, etc.) for validation, **Controllers and Services** for structure, and let Corpus handle the HTTP layer. No magic, no hidden abstractions.

## Core Building Blocks

### Routes & Controllers

Register routes directly or group them in a Controller. Routes match against path parameters automatically using the RegExp-based router.

```ts
// Simple route
new C.Route("/health", () => "ok");

// Or in a Controller with prefix
export class ItemController extends C.Controller {
	constructor(private service: ItemService) {
		super();
	}

	prefix = "/item";

	create = this.route(
		{ method: "POST", path: "/create" },
		(c) => this.service.create(c.body),
		ItemModel.create, // schema validation
	);
}
```

### Schema Validation

Use any Standard Schema library (arktype, zod, etc.). Define your data shape once and Corpus validates requests automatically.

```ts
import { type } from "arktype";

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
```

### Context (c)

Handlers receive a [Context](/context.html) object with request data, body, params, and a data object for storing request-scoped values.

```ts
create = this.route(
	{ method: "POST", path: "/create" },
	async (c) => {
		// c.body is already validated
		// c.params has path parameters
		// c.data is a plain object you can use
		return this.service.create(c.body);
	},
	ItemModel.create,
);
```

### Middleware

Register middleware to run before routes. Middleware can validate, log, authenticate, or modify the context.

```ts
export class AuthMiddleware extends C.Middleware {
	override handler: MiddlewareHandler = async (c) => {
		const token = c.headers.get("authorization");
		if (!token) throw new C.Exception("no token", 401);
		c.data.user = await verifyToken(token);
	};
}
```

## The Recommended Pattern

Corpus works best when you follow this structure:

1. **Models** — Define your data shape using a schema library
2. **Repository** — Your own repository code.
3. **Service** — Business logic that uses the repository
4. **Controller** — HTTP handlers that call the service

This keeps your code testable and organized without forcing a specific DI system.

## What You Get

- **Route Registration** — Routes and Controllers, with automatic regex-based routing and params.
- **Schema Validation** — Works with any Standard Schema library (arktype, zod, etc.).
- **Static Routes** — Serve static files with StaticRoute or via Controller.
- **Middleware** — Register global or route-specific middleware easily.
- **Extras Module** — CORS, router adapters, and utilities like env helper.
- **Error Handling** — Structured error responses with Exception and built-in status codes.

## What You Don't Get (And That's Okay)

- **ORM** — Use Drizzle, Prisma, or your own queries. Corpus doesn't care.
- **DI System** — Instantiate your classes manually. You control the order.
- **Session Management** — Plug in whatever you need.
- **Template Engine** — Return JSON or use any render library.

## Important: Bun Only (For Now)

Corpus currently runs on Bun. Node.js support is implemented internally but not tested for production. All contributions are welcome.

## Inspired By

Corpus takes inspiration from [Elysia](https://github.com/elysiajs/elysia) and strips it down to the essentials. It is simpler and built for personal projects.

## Extensibility

You can extend several interfaces to customize behavior:

```ts
declare module "@ozanarslan/corpus" {
	interface Env {} // X.Config env interface
	interface ContextDataInterface {} // Context data shape (c.data)
}
```

## Next Steps

Ready to build? Check out [Quick Start](/quick-start.html) for a working example, or dive into [Server](/server.html) to understand configuration.

## What is a Func?

Throughout this documentation you'll see a type named Func with generics. It's just a helper I use to write function types because I don't like writing arrow functions.

```ts
type Func<Args extends any[] = any[], Return = any> = (...args: Args) => Return;
```

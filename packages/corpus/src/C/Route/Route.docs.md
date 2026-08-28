---
toc:
  - title: Usage
    url: "#usage"
  - title: Parameters
    url: "#parameters"
  - title: Properties
    url: "#properties"
---

# Route

The `Route` class (variant `dynamic` internally) defines an HTTP endpoint with automatic registration to the global router. It accepts a flexible address (a path string, a `"VERB /path"` string, or an object with `method` and `path`) and a handler that receives the request context. Routes can optionally include a model for request/response validation and type safety.

## Extends RouteAbstract, BaseRoute

This object extends [RouteAbstract](/RouteAbstract) which itself extends [BaseRoute](/BaseRoute).

## Usage

Routes can be instantiated directly with `new`. The constructor automatically registers the route to the global router store.

### Simple GET route

```ts
import { C } from "@ozanarslan/corpus";

// GET /users
new C.Route("/users", () => [{ id: 1, name: "Alice" }]);
```

### Route with specific HTTP method

Either use the object form or prefix the path string with an HTTP verb:

```ts
import { C } from "@ozanarslan/corpus";

// GET /users
new C.Route("/users", () => []);

// POST /users
new C.Route({ method: C.Method.POST, path: "/users" }, (c) => ({ created: true }));

// DELETE /users/:id
new C.Route("DELETE /users/:id", (c) => ({ deleted: c.params.id }));
```

### Route with validation model

```ts
import { C } from "@ozanarslan/corpus";
import { z } from "zod";

const UserModel = {
	body: z.object({ name: z.string(), email: z.email() }),
	response: z.object({ id: z.number(), name: z.string() }),
};

new C.Route(
	{ method: C.Method.POST, path: "/users" },
	// c.body is typed as { name: string; email: string }
	(c) => ({ id: 1, name: c.body.name }),
	UserModel,
);
```

### Extending the abstract class

The model type inference becomes useless this way, so it's not recommended.

```ts
class MyRoute extends C.RouteAbstract {
	constructor() {
		super();
		// this method needs to be called to register it to the router
		// here or where you instantiate
		this.register();
	}

	override endpoint: string = "/extended";
	override method: C.Method = C.Method.GET;
	override handler: Func<[context: C.Context<unknown, unknown, unknown, unknown>], unknown> = () =>
		"extended";
}
```

## Parameters

### address

The route address. A plain path string defaults to `GET`. A string containing whitespace must start with a valid HTTP verb (case-insensitive, resolved to uppercase) followed by the path, otherwise resolution throws. The object form is equivalent to the verb-prefixed string.

| Value                                | Result              |
| ------------------------------------ | ------------------- |
| `"/users"`                           | `GET /users`        |
| `"DELETE /users/:id"`                | `DELETE /users/:id` |
| `{ method: "POST", path: "/users" }` | `POST /users`       |

### callback

The route handler function. Receives the Context object with parsed data, req, and res.

### model

Optional validation model for the request body, search params, URL params, and response. When provided, the context properties are typed and validated automatically. You can pass generics if you don't want to bother with validation but still typecast your data: `Route<B, S, P, R, E extends string>`

#### Route Models can have mixed validators

```ts
{
	body: z.object({ name: z.string(), email: z.email() }),
	response: type({ id: "number", name: "string" }),
}
```

## Properties

### endpoint

The raw endpoint of this route.

### method

The method of this route.

### handler

The handler. Receives type [Context](/Context), can return anything stringifiable.

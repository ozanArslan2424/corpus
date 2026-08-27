# Route

The `Route` class (variant `dynamic` internally) defines an HTTP endpoint with automatic registration to the global router. It accepts a flexible address (a path string, a `"VERB /path"` string, or an object with `method` and `path`) and a handler that receives the request context. Routes can optionally include a model for request/response validation and type safety.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)

</section>

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

// POST /users
new C.Route({ method: C.Method.POST, path: "/users" }, (c) => {
	return { created: c.body.name };
});

// DELETE /users/:id
new C.Route("DELETE /users/:id", (c) => {
	return { deleted: c.params.id };
});
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
	(c) => {
		// c.body is typed as { name: string; email: string }
		return { id: 1, name: c.body.name };
	},
	UserModel,
);
```

### Handler return types

Handlers can return:

- **Plain data**: automatically wrapped in `Res` (objects become JSON, strings become text, etc.) with applied headers.
- **`Res`**: for custom status codes, headers, or response control.
- **Web `Response`**: a plain standard `Response` for cases where full control over the response is needed.

```ts
// Automatic JSON response
new C.Route("/users", () => ({ users: [] }));

// Custom Res
new C.Route("/error", () => {
	return new C.Res("Not Found", { status: 404 });
});
```

### Extending the abstract class

I wouldn't recommend extending since the model parsing basically becomes useless.

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

## Constructor Parameters

### address

`RouteAddress<E>`

The route address. A plain path string defaults to `GET`. A string containing whitespace must start with a valid HTTP verb (case-insensitive, resolved to uppercase) followed by the path, otherwise resolution throws. The object form is equivalent to the verb-prefixed string.

```ts
type RouteAddress<E extends string = string> = E | `${Method} ${E}` | { method: Method; path: E };
```

| Value                                | Result              |
| ------------------------------------ | ------------------- |
| `"/users"`                           | `GET /users`        |
| `"DELETE /users/:id"`                | `DELETE /users/:id` |
| `{ method: "POST", path: "/users" }` | `POST /users`       |

### callback

`(context: Context<B, S, P, R>) => MaybePromise<R>`

The route handler function. Receives the request context with typed access to body (`c.body`), search params (`c.search`), URL params (`c.params`), Req (`c.req`), and Res for response manipulation without returning a Res (`c.res`).

### model (optional)

`RouteModel<B, S, P, R>`

Optional validation model for the request body, search params, URL params, and response. When provided, the context properties are typed and validated automatically. See [Model](/Parser/Model.html). You can pass generics if you don't want to bother with validation but still typecast your data: `Route<B, S, P, R, E extends string>`

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

| Property   | Type                      | Description                                                        |
| ---------- | ------------------------- | ------------------------------------------------------------------ |
| `id`       | `string`                  | Unique route identifier (`{METHOD} {endpoint}`, e.g. `GET /users`) |
| `method`   | `Method`                  | HTTP method resolved from the address, defaults to `GET`           |
| `endpoint` | `E`                       | Resolved path                                                      |
| `handler`  | `Func`                    | The route handler function                                         |
| `model`    | `RouteModel \| undefined` | Validation model if provided                                       |
| `variant`  | `RouteVariant.dynamic`    | Fixed to `dynamic` for this class                                  |

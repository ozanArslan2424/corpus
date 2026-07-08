# Context

The small c in Corpus. The `Context` class is the request context object passed to route handlers. It provides typed access to the request data, headers, cookies, parsed body, URL parameters, search parameters, and response manipulation. The four generics (B, S, P, R) are resolved from the route's model parameter.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)
4. [Static Methods](#static-methods)

</section>

## Usage

The context is automatically created and passed to your route handlers. Access request data and build responses through its properties. Most of the context properties come from the request. the body is parsed using a clone which means you can consume the body even after it's parsed.

### Basic context access

```ts
import { C } from "@ozanarslan/corpus";

new C.Route("/users/:id", (c) => {
	// Access URL parts
	console.log(c.url.pathname); // /users/123

	// Access headers
	const auth = c.headers.get("authorization");

	// Access cookies
	const session = c.cookies.get("sessionId");

	// Access parsed params (typed if model/generic provided)
	const userId = c.params.id;

	// Access parsed search params
	const page = c.search.page;

	// Modify response headers
	c.res.headers.set("x-custom", "value");

	return { userId };
});
```

### Setting response data

```ts
new C.Route("/data", (c) => {
	// Set status code
	c.res.status = 201;

	// Set headers
	c.res.headers.set("content-type", "application/json");

	// Return data (will be serialized)
	return { created: true };
});
```

### Attaching custom data

```ts
import { C } from "@ozanarslan/corpus";

// Extend ContextDataInterface via module augmentation
declare module "@ozanarslan/corpus" {
	interface ContextDataInterface {
		user?: { id: number; name: string };
		requestId?: string;
	}
}

// Middleware sets data
const authMiddleware = new C.Middleware({
	variant: "inbound",
	useOn: "*",
	handler: async (c) => {
		c.data.user = await verifyToken(c.headers.get("authorization"));
		c.data.requestId = crypto.randomUUID();
	},
});

// Handler accesses typed data
new C.Route("/profile", (c) => {
	// you can also assign here
	// c.data.user is typed as { id: number; name: string } | undefined
	return { user: c.data.user, requestId: c.data.requestId };
});
```

See [Extensibility](/intro.html#extensibility) for other extendable interfaces.

## Constructor Parameters

Context is typically not instantiated directly — it is created by the framework router. The constructor parameters are:

| Parameter | Type | Description                                      |
| --------- | ---- | ------------------------------------------------ |
| req       | Req  | The incoming request instance                    |
| res       | Res  | Optional response instance (defaults to new Res) |

## Properties

| Property | Type                 | Description                                        |
| -------- | -------------------- | -------------------------------------------------- |
| req      | Req                  | The request instance with raw access               |
| url      | URL                  | Standard Web API URL object                        |
| headers  | CHeaders             | Request headers                                    |
| cookies  | Cookies              | Request cookies                                    |
| body     | B                    | Parsed and validated request body                  |
| search   | S                    | Parsed and validated URL search parameters         |
| params   | P                    | Parsed and validated URL path parameters           |
| res      | Res                  | Response builder for setting status, headers, etc. |
| data     | ContextDataInterface | Custom data storage for middleware communication   |

## Static Methods

### appendParsedData

`static async appendParsedData(ctx, req, data): Promise<void>`

Parses and validates body, params, and search data using the route's model, then attaches them to the context. Called internally before the route handler executes.

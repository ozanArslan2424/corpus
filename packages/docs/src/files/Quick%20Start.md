# Quick Start

Get a Corpus server running in minutes. This guide walks you through installation and creating your first route.

<section class="table-of-contents">

##### Contents

1. [Installation](#installation)
2. [Create Your Server](#create-your-server)
3. [Add Validation](#add-validation)
4. [Organize with Controllers](#organize-with-controllers)
5. [Add Middleware](#add-middleware)
6. [Next Steps](#next-steps)

</section>

## Installation

Install Corpus using your package manager:

```sh
bun add @ozanarslan/corpus
```

## Create Your Server

Create a simple server with a single route:

```ts
import { C } from "@ozanarslan/corpus";

const server = new C.Server();

new C.Route("/health", () => {
	return { status: "ok" };
});

server.listen(3000);
console.log("Server running on http://localhost:3000");
```

Run it:

```sh
bun src/index.ts
```

Your server is now running at `http://localhost:3000`.

## Add Validation

Use a schema library to validate request data. This example uses arktype:

```ts
import { C } from "@ozanarslan/corpus";
import { type } from "arktype";

const ItemsCreateBody = type({
	name: "string",
	description: "string",
});

const server = new C.Server();

new C.Route(
	{ method: "POST", path: "/items" },
	(c) => {
		// c.body is automatically validated
		return { created: true, item: c.body };
	},
	{ body: ItemsCreateBody },
);

server.listen(3000);
```

## Organize with Controllers

Group related routes in a Controller:

```ts
import { C } from "@ozanarslan/corpus";

export class ItemController extends C.Controller {
	constructor() {
		super();
	}

	prefix = "/items";

	list = this.route({ method: "GET", path: "/" }, (c) => {
		return { items: [] };
	});

	create = this.route({ method: "POST", path: "/" }, (c) => {
		return { created: true };
	});
}

const server = new C.Server();
new ItemController();
server.listen(3000);
```

Controllers automatically register with the server. No manual setup needed.

## Add Middleware

Create middleware to run before all routes:

```ts
import { C } from "@ozanarslan/corpus";

export class LoggerMiddleware extends C.Middleware {
	override handler: C.MiddlewareHandler = async (c) => {
		console.log(`[${new Date().toISOString()}] ${c.method} ${c.path}`);
	};
}

const server = new C.Server();
new LoggerMiddleware();
new C.Route("/", () => "Hello");
server.listen(3000);
```

Middleware can validate requests, add data to the context, or return early with a response.

## Next Steps

- Check out the [Introduction](/intro.html) for the recommended project structure
- Read about [Server](/server.html) configuration options
- Explore the rest of the modules at your own pace.

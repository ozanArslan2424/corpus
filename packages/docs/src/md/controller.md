# Controller

The `Controller` class provides a base for grouping related routes under a shared URL prefix and optional middleware. Extend this class to organize your application into logical units (e.g., `UserController`, `PostController`). Routes registered via `route()` and `staticRoute()` automatically inherit the controller's prefix and run `beforeEach` before the handler if set.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Properties](#properties)
3. [Methods](#methods)

</section>

## Usage

Controllers are created by extending the `Controller` class and instantiating the subclass. Routes are defined as class properties using `this.route()` or `this.staticRoute()`. This is an abstract class you cannot instantiate it directly.

### Basic controller

```ts
import { C } from "@ozanarslan/corpus";

class UserController extends C.Controller {
	// prefix is abstract, you don't need to add override,
	// typescript lsp's usually add it automatically though.
	override prefix?: string | undefined = "/users";
	// OR
	// prefix: string = "/users";
	// OR
	// prefix = "/users";

	getAll = this.route("/", () => getAllUsers());

	getById = this.route("/:id", (c) => getUser(c.params.id));

	create = this.route({ method: C.Method.POST, path: "/" }, (c) => {
		return createUser(c.body);
	});
}

// Creates: GET /users, GET /users/:id, POST /users
new UserController();
```

### Controller with beforeEach middleware

```ts
import { C } from "@ozanarslan/corpus";

class ProtectedController extends C.Controller {
	prefix = "/admin";

	// This is undefined by default so you need to override it.
	override beforeEach?: C.MiddlewareHandler | undefined = async (c) => {
		if (!c.headers.has("authorization")) {
			throw new C.Exception("Unauthorized", 401);
		}
	};

	dashboard = this.route("/", () => "Admin panel");
	stats = this.route("/stats", () => getStats());
}

// All routes run auth check before handler
new ProtectedController();
```

### Controller with static routes

```ts
import { C } from "@ozanarslan/corpus";

class AssetController extends C.Controller {
	prefix = "/assets";

	logo = this.staticRoute("/logo", "assets/logo.png");

	video = this.staticRoute("/trailer", {
		filePath: "assets/trailer.mp4",
		stream: true,
	});
}

// Creates: GET /assets/logo, GET /assets/trailer
new AssetController();
```

## Properties

| Property            | Type                  | Description                                     |
| ------------------- | --------------------- | ----------------------------------------------- |
| `abstract prefix`   | `string \| undefined` | The controller's URL prefix                     |
| `beforeEach`        | `Func \| undefined`   | Optional middleware run before each handler     |
| `readonly routeIds` | `Set<string>`         | Set of registered route IDs for this controller |

## Methods

### route

`protected route(definition, handler, model?) => DynamicRoute`

Registers a dynamic route under this controller. Identical to `new DynamicRoute()` but automatically prepends the controller prefix and wraps the handler with `beforeEach` if set.

```ts
this.route("/", () => "hello");
this.route({ method: C.Method.POST, path: "/" }, (c) => c.body);
this.route("/:id", (c) => c.params.id, { params: IdModel });
```

### staticRoute

`protected staticRoute(path, definition, handler?, model?) => StaticRoute`

Registers a static file route under this controller. Identical to `new StaticRoute()` but automatically prepends the controller prefix.

```ts
this.staticRoute("/file", "assets/file.txt");
this.staticRoute("/video", { filePath: "assets/video.mp4", stream: true });
```

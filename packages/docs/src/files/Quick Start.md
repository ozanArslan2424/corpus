# Quick Start

A minimal HTTP framework for [Bun](https://bun.sh), written in TypeScript with zero runtime dependencies.

Corpus is built around plain classes. A route is an object you construct, not a callback you hand to a builder — so routes, controllers and middleware are values you can hold, extend, and call directly in a test without starting a server. Request parsing is lazy and analysed ahead of time: a body nobody reads is never parsed, and a route with no schemas skips validation entirely.

Validation uses [Standard Schema](https://standardschema.dev), so Zod, Valibot, ArkType and anything else implementing the spec work out of the box, and their inferred types flow into your handlers.

## Install

```bash
bun add @ozanarslan/corpus
```

Bun 1.2 or newer. Corpus uses `Bun.serve`, `Bun.file` and `Bun.CookieMap`, so it does not run on Node. Node support may be implemented in the future.

## Hello world

```ts
import { C } from "@ozanarslan/corpus";

const app = new C.App({ port: 3000 });

new C.Route("GET /", () => ({ message: "hello" }));

await app.listen();
```

```bash
bun run index.ts
```

Constructing a `C.Route` registers it on the most recently constructed `C.App`, so you never pass the app around. Nothing is compiled until `listen()`, which means routes and middleware can be declared in any order across any number of files.

## Responses

Return a value and corpus works out how to send it — objects become JSON, strings become text, typed arrays stay binary, streams pass through untouched. Each gets a matching `Content-Type` unless you set one yourself.

```ts
new C.Route("GET /users", () => users); // application/json
new C.Route("GET /ping", () => "pong"); // text/plain
new C.Route("GET /avatar", () => imageBytes); // application/octet-stream
```

Reach for `C.Res` when you need a status, headers, cookies, or a body form a return value can't express. `Context` holds a fresh value by default so there is no need to construct it again.

```ts
new C.Route("POST /users", async (c) => {
	const user = await createUser(c.body);
	return new C.Res(user, { status: C.Status.CREATED });
});

new C.Route("GET /report", (c) => c.res.file("./report.pdf"));
new C.Route("GET /old", (c) => c.res.permanentRedirect("/new"));

new C.Route("GET /users", (c) => {
	c.res.headers.set("X-Total-Count", users.length);
	c.res.cookies.set("seen", "1");
	return users;
});
```

## The context

Every handler receives a `Context` holding the request and its parsed views.

```ts
new C.Route("POST /users/:id/notes", (c) => {
	c.params; // parsed path parameters
	c.search; // parsed query string
	c.body; // parsed request body
	c.data; // request-scoped state, shared with middleware
	c.req; // the untouched Request
	c.res; // the response being built
	c.url; // the Request's URL object
});
```

`params`, `search` and `body` are populated only when your handler chain actually reads them — corpus inspects the handlers at startup to decide. Query strings and form bodies support bracket nesting, so `?filter[status]=open&tags[0]=a` arrives as a real object, and repeated keys collect into arrays.

## Validation

Pass schemas as the third argument. They validate the request and type the context:

```ts
import { z } from "zod";

new C.Route(
	"POST /users",
	(c) => createUser(c.body), // c.body is typed from the schema
	{
		body: z.object({ email: z.string().email(), age: z.number() }),
		search: z.object({ notify: z.boolean().optional() }),
	},
);
```

A failure responds with `422` and a message naming the offending fields and what was received.

The same object also takes `maxRequestBodySize`, to tighten the app-wide limit for one endpoint:

```ts
new C.Route("POST /upload", handler, { maxRequestBodySize: 50 * 1024 * 1024 });
```

## Errors

Throw a `C.Exception` to end a request with a status. Anything else that throws becomes an opaque `500`, so an accidental `TypeError` never leaks its message. Replace `app.handleError` to change how errors are rendered.

```ts
new C.Route("GET /users/:id", (c) => {
	const user = findUser(c.params.id);
	if (!user) throw new C.Exception("User not found", C.Status.NOT_FOUND);
	return user;
});
```

## Middleware

A middleware runs around whatever comes after it. Everything before `await next()` happens on the way in, everything after it on the way out. Return early instead of calling `next()` to short-circuit the chain.

```ts
new C.Middleware({
	handler: async (c, next) => {
		const started = performance.now();
		const result = await next();
		c.res.headers.set("X-Response-Time", performance.now() - started);
		return result;
	},
});
```

With no `useOn`, it applies to every route. Target specific ones by passing routes, controllers, or route ids:

```ts
const usersRoute = new C.Route("GET /users", handler);

new C.Middleware({
	useOn: usersRoute,
	handler: (c, next) => {
		if (!isAuthorized(c.req)) throw new C.Exception("Unauthorized", C.Status.UNAUTHORIZED);
		return next();
	},
});
```

Use `c.data` to pass state downstream. Augment `ContextDataInterface` to type it:

```ts
declare module "@ozanarslan/corpus" {
	interface ContextDataInterface {
		user: User;
	}
}
```

## Controllers

A `C.Controller` groups routes under a shared prefix and an optional preamble. Subclassing is recommended.

```ts
const users = new C.Controller("/users");
users.beforeEach = (c) => authenticate(c);

users.route("GET /", () => listUsers());
users.route("GET /:id", (c) => findUser(c.params.id));
users.route("POST /", (c) => createUser(c.body), { body: userSchema });

class UserController extends C.Controller {
	constructor(private readonly service: UserService) {
		super("/users");
	}

	list = this.route("GET /", () => this.service.list());
}
```

The methods mirror the route constructors exactly, so moving a route into a controller only changes the call site. `users.routeIds` gives you the whole group to target with middleware.

## Serving files

Four route kinds, differing in what they read and when.

```ts
// One file, read per request.
new C.FileRoute("GET /robots.txt", "./public/robots.txt");
new C.FileRoute("GET /report", { filePath: "./report.pdf", disposition: "attachment" });

// One file, read once at startup and held in memory.
new C.StaticRoute("GET /about", "./pages/about.html");

// ...optionally passed through a handler first, for templating.
new C.StaticRoute("GET /", "./pages/index.html", (c, html) => html.replace("{{title}}", title));

// A whole directory of built files, with per-file-class caching.
new C.BundleRoute("/*", "./dist");
```

`C.BundleRoute` answers unresolvable paths with the entry document instead of a 404, which is what keeps a single-page app working on a hard refresh. Hashed assets are cached immutably, the entry document is revalidated every time.

## Streaming

```ts
// Server-sent events
new C.Route("GET /events", (c) =>
	c.res.sse(async (send) => {
		for await (const event of source) send({ data: event, event: "update" });
	}),
);

// Newline-delimited JSON
new C.Route("GET /export", (c) =>
	c.res.ndjson(async (send) => {
		for await (const row of rows) send(row);
	}),
);

// A file, without buffering it
new C.Route("GET /video", (c) => c.res.streamFile("./clip.mp4", "inline"));
```

Return a cleanup function from an `sse` or `ndjson` source to keep the stream open indefinitely; it runs when the client disconnects.

## WebSockets

```ts
new C.WebSocketRoute("/chat", {
	onOpen: (ws) => ws.subscribe("room"),
	onMessage: (ws, message) => ws.publish("room", message),
	onClose: (ws) => ws.unsubscribe("room"),
});
```

One route instance backs every connection, so per-socket state belongs on the socket, not on the route.

## CORS

```ts
new C.Cors({
	allowedOrigins: ["https://example.com"],
	allowedMethods: ["GET", "POST"],
	credentials: true,
});
```

CORS runs after the middleware chain, separately from it, so a short-circuiting middleware can't drop the headers. Without a `C.Cors`, preflights get a bare `204` and no CORS headers are sent.

## Rate limiting

```ts
new C.RateLimiter({
	windowMs: 60_000,
	limits: { authenticated: 120, ipBased: 60, fingerprint: 20 },
});
```

Callers are identified by what the request proves about itself — a token, then an IP, then a header fingerprint — each with its own limit, since they differ in how forgeable they are. Identifiers are hashed with a rotating salt, so no token or address is ever held in memory.

Construct it after your routes; it targets the ones registered so far, excluding bundle routes. Counting is in-process by default — pass a `store` implementing `RateLimiterStoreInterface` to share state across instances.

## Testing routes

Routes are objects, so call one directly. No server, no HTTP:

```ts
import { expect, test } from "bun:test";

const route = new C.Route("GET /users/:id", (c) => findUser(c.params.id));

test("finds a user", async () => {
	const result = await route.handle({ params: { id: 1 } });
	expect(result).toEqual({ id: 1, name: "Ada" });
});
```

`handle()` takes already-parsed values and runs the handler alone — middleware and validation are the app's job, not the route's. To exercise the full pipeline, use `app.handle(request)`.

## Configuration

`C.Config` reads environment variables with parsing and fallbacks:

```ts
C.Config.get("PORT", { parser: Number, fallback: 3000 });
C.Config.require("DATABASE_URL"); // throws if unset
C.Config.isProd;
```

Augment `Env` to get autocompletion for your own variables:

```ts
declare module "@ozanarslan/corpus" {
	interface Env {
		DATABASE_URL: string;
		JWT_SECRET: string;
	}
}
```

## Replacing the parsers

Every parsing decision resolves through one registry, and every slot is typed as an interface rather than a class — so a replacement only has to satisfy the contract.

```ts
C.setParsersRegistry({ bodyParser: new MyBodyParser() });
```

Call it before `app.listen()`. Routes resolve their parsers as they are compiled, so a later override is never reached.

## App options

```ts
const app = new C.App({
	port: 3000,
	hostname: "0.0.0.0",
	prefix: "/api",
	idleTimeout: 30,
	maxRequestBodySize: 10 * 1024 * 1024,
	tls: { cert, key },
});

app.handleBeforeListen = () => {
	db.connect();
};
app.handleBeforeClose = () => {
	db.disconnect();
};

await app.listen();
```

`listen()` installs `SIGINT` and `SIGTERM` handlers, so the app shuts down cleanly on its own.

## License

MIT

# Server

The `Server` class is typically the first module you'll interact with in Corpus. It must be instantiated before any `Route`, `Middleware`, or `Controller` objects are created, as its constructor establishes and registers the global routing for your application. The `Server` class is part of the `C` (Corpus) module, which serves as the core container for all essential components of an HTTP server.

<section class="table-of-contents">

##### Contents

1. [Constructor Parameters](#constructor-parameters)
2. [Methods](#methods)

</section>

## Constructor Parameters

When instantiating a new `Server`, you may optionally provide a configuration object with the following properties:

### `idleTimeout`

Sets the maximum time (in milliseconds) that an idle connection will be kept open before being automatically closed. This helps manage server resources by cleaning up connections that are no longer active.

### `tls`

Configures Transport Layer Security (TLS/SSL) for the server, enabling HTTPS support. The object accepts the following properties:

- **`cert`** (required): The certificate for the server, provided as a string or Buffer.
- **`key`** (required): The private key corresponding to the certificate, provided as a string or Buffer.
- **`ca`** (optional): The certificate authority chain, provided as a string or Buffer.

Example:

```ts
const server = new C.Server({
	idleTimeout: 30000,
	tls: {
		cert: readFileSync("./cert.pem"),
		key: readFileSync("./key.pem"),
	},
});
```

## Methods

### `.routes`

A getter that returns an array of all registered route data. This provides visibility into the current routing table and can be useful for debugging or introspection.

### `.listen`

Instructs the server to begin listening for connections on a specified port and optional hostname. This method accepts a required `port` argument and an optional `hostname`. It is asynchronous to support operations defined in `handleBeforeListen`, though it does not return a value.

Example:

```ts
import { C } from "@ozanarslan/corpus";

const server = new C.Server();
// As the method is asynchronous, consider using await or void to satisfy linter expectations.
void server.listen(3000, "0.0.0.0");
```

### `.close`

The counterpart to `.listen`, this method stops the underlying server from accepting new connections. It accepts a boolean argument, `closeActiveConnections`, to determine whether active connections should be terminated. This method is also asynchronous to accommodate operations in `handleBeforeClose`. Unless the `NODE_ENV` is set to `"test"`, the process will exit with a status code of `0`.

Note: By default, `closeActiveConnections` is `true`, which differs from Bun's default behavior (`false`).

Example:

```ts
void server.listen(3000, "0.0.0.0");
void server.close();
```

### `.handle`

The `.handle` method is intended for scenarios where you want to process requests without starting a network listener—most commonly in unit tests. It accepts a `Request` object and returns a `Promise<Response>`.

Note: This method does not support WebSocket upgrades, and the process will exit if such an upgrade is attempted.

Example:

```ts
const server = new C.Server();
new C.Route("/hello", () => "world"); // see the Route (dynamic) module
// The port is arbitrary; Request requires a complete URL.
const req = new Request("http://localhost:1234/hello"); // or C.Req
const res = await server.handle(req); // resolves successfully
const data = await res.text(); // returns "world"
```

### `.setOnError`

Registers a custom error handler for the server. When an unhandled error occurs during request processing, this handler will be invoked. The default error handler responds with a status of `C.Exception` (or `500`) and returns JSON in the following format:

```ts
{ error: unknown | true, message: string }
```

If a non-error instance is thrown, the default response will still return a `500` status with:

```ts
{ error: Instance, message: "Unknown" }
```

The default error handler is also accessible via the `.defaultErrorHandler` property.

### `.setOnNotFound`

Sets a custom handler for requests that do not match any registered route. The default not-found handler responds with a `404` status and returns JSON in the following format:

```ts
{ error: true, message: `${req.method} on ${req.url} does not exist.` }
```

The default not-found handler is also accessible via the `.defaultNotFoundHandler` property.

### `.setOnBeforeListen`

Defines an asynchronous or synchronous function to be executed just before the server begins listening. This is useful for performing preparatory tasks such as database connection validation or logging. The default value is `undefined`, which can be accessed via `.defaultOnBeforeListen`.

### `.setOnBeforeClose`

Defines an asynchronous or synchronous function to be executed just before the server closes. This allows for graceful cleanup operations such as closing database connections or flushing logs. The default value is `undefined`, which can be accessed via `.defaultOnBeforeClose`.

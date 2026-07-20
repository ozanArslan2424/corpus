# Cors

The Cors class provides a simple outbound middleware for setting CORS (Cross-Origin Resource Sharing) headers on responses. It automatically registers to the global registry on instantiation. Can be swapped out, see [Registry Customization](/Registry.html).

See [MDN: Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) for detailed CORS concepts.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Preflight Handling](#preflight-handling)

</section>

## Usage

### Basic CORS setup

```ts
import { C } from "@ozanarslan/corpus";

new C.Cors({
	allowedOrigins: ["https://example.com", "https://app.example.com"],
	allowedMethods: ["GET", "POST", "PUT", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization"],
});
```

### With credentials and exposed headers

```ts
new C.Cors({
	allowedOrigins: ["https://trusted.com"],
	credentials: true,
	exposedHeaders: ["X-Request-Id", "X-Rate-Limit"],
});
```

## Constructor Parameters

### `opts`

`CorsOptions | undefined`

CORS configuration options. Pass `undefined` for permissive defaults (wildcard origin, no credentials).

| Option         | Type           | Default | Description                                                                                                                                     |
| -------------- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| allowedOrigins | `string[]`     | `["*"]` | Origins permitted to access the resource. When `credentials` is true, wildcard is not allowed — the actual request origin is reflected instead. |
| allowedMethods | `string[]`     | —       | HTTP methods allowed. Sets `Access-Control-Allow-Methods`.                                                                                      |
| allowedHeaders | `CHeaderKey[]` | —       | Headers clients may send. Sets `Access-Control-Allow-Headers`.                                                                                  |
| exposedHeaders | `CHeaderKey[]` | —       | Response headers exposed to client JavaScript. Sets `Access-Control-Expose-Headers`.                                                            |
| credentials    | `boolean`      | —       | Whether to expose cookies and auth headers. Sets `Access-Control-Allow-Credentials`.                                                            |
| maxAge         | `number`       | `86400` | How long preflight results can be cached in seconds. Sets `Access-Control-Max-Age`.                                                             |

## Preflight Handling

Cors exposes a `handlePreflight`. It's a request handler suitable for `server.handlePreflight`. This handles `OPTIONS` preflight requests with the same origin logic as the outbound middleware, and additionally sets the `Access-Control-Max-Age` header.

```ts
import { C } from "@ozanarslan/corpus";

const server = new C.Server();
const cors = new C.Cors({ allowedOrigins: ["https://example.com"] });

// handled internally:
export class Server {
    ...

	protected handlePreflight: RequestHandler = async (req) => {
		if ($registry.cors === null) {
			return new Res(undefined, { status: Status.NO_CONTENT });
		}
		return $registry.cors.handlePreflight(req);
	};

    ...
}
```

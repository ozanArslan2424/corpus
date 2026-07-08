# Middleware

The Middleware class registers inbound or outbound middleware into the global router. Inbound middleware runs before route handlers; outbound middleware runs after. Both variants receive the request context and can return a [Res](/res.html) to short-circuit the request, or void to continue.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)
4. [types](#types)

</section>

## Usage

As with many modules, the Middleware class can be instantiated directly with new or extended using the abstract class. The middlewares are automatically registered and inserted into the lifecycle inside the constructor.

### With new

```ts
import { C } from "@ozanarslan/corpus";

const server = new C.Server();

new C.Middleware({
	variant: "inbound",
	useOn: "*",
	handler: async (c) => {
		if (!c.headers.get("authorization")) {
			return new C.Res("Unauthorized", { status: 401 });
		}
	},
});

void server.listen(3000);
```

### Extending

```ts
import { C } from "@ozanarslan/corpus";
import { SomeService } from "./SomeService";

class SomeMiddleware extends C.MiddlewareAbstract {
	constructor(
		private readonly someService: SomeService,
		override readonly useOn: C.MiddlewareUseOn,
	) {
		super();
		// this method needs to be called to register it to the router
		// here or where you instantiate
		this.register();
	}

	override handler: C.MiddlewareHandler = (c) => {
		return this.someService.fn(c.headers);
	};
}

const server = new C.Server();
const someRoute = new C.Route("/", () => "ok");
const someService = new SomeService();
new SomeMiddleware(someService, { useOn: [someRoute] });
void server.listen(3000);
```

## Constructor Parameters

### `variant`

Either "inbound" or "outbound". Defaults to "inbound". Inbound middlewares run before the handlers and outbound middlewares run after. Mental model if coming from NestJS:

| Corpus                             | NestJS                                           |
| ---------------------------------- | ------------------------------------------------ |
| Inbound Middleware returning void  | Middleware (calling `next()`)                    |
| Outbound Middleware returning void | Interceptor (post-handler, returning observable) |
| Inbound Middleware returning Res   | Guard returning `false` or throwing              |
| Outbound Middleware returning Res  | Exception Filter catching and transforming       |
| Inbound Middleware throwing        | Guard or Middleware throwing                     |
| Outbound Middleware throwing       | Interceptor or Exception Filter throwing         |

### `useOn`

The route(s) and/or controller(s) this middleware applies to. Pass `"*"` to apply globally to all routes.

### `handler`

The middleware function. Receives the request context and can return a Res or throw and error to halt further processing, or void to pass through.

## Properties

All constructor options are stored as readonly properties: `variant`, `useOn`, and `handler`.

## types

```ts
export const MiddlewareVariant = {
	inbound: "inbound",
	outbound: "outbound",
} as const;

export type MiddlewareVariant = ValueOf<typeof MiddlewareVariant>;

export type MiddlewareHandler = Func<[context: Context], Bun.MaybePromise<void | Res>>;

export type MiddlewareOptions = {
	variant?: MiddlewareVariant;
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

export type MiddlewareUseOn =
	| Array<BaseRoute<any, any, any, any> | Controller | string>
	| BaseRoute<any, any, any, any>
	| Controller
	| "*";
```

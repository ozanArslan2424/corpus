# Registry

The `Registry` class is NOT part of the public Corpus API. It is the global container that holds every runtime dependency Corpus uses — the router, adapter, middleware router, entity store, parsers, [Cors](/Cors.html), and the global prefix. The registry is _plug & play_, so you can swap any of its fields with your own implementation as long as you satisfy the corresponding interface.

The registry instance can be accessed through `$registry`. Note that `$registry` itself cannot be reassigned — only its fields can be swapped.

Each [Route](/route.html), [StaticRoute](/route-static.html), [WebSocketRoute](/route-websocket.html), [Controller](/controller.html), and [Middleware](/middleware.html) object registers itself into the global registry at construction time. This means any field you intend to replace must be swapped _before_ those objects are constructed, otherwise registrations will land on the old instance. Making all replacements at the top of your app would be a safe bet.

All interfaces can be imported by name, they are not namespaced to C or X.

<section class="table-of-contents">

##### Contents

1. [Plug & Play](#plug-and-play)
2. [Swappable Fields](#swappable-fields)
3. [Non-Swappable Fields](#non-swappable-fields)
4. [Interfaces](#interfaces)

</section>

## Plug & Play

```ts
import { $registry } from "@ozanarslan/corpus";
// Assign it directly through the setter.
$registry["what_you_need_to_replace"] = new MyReplacement();
```

## Swappable Fields

Each of the following fields can be reassigned with a custom implementation that satisfies the listed interface. All interfaces and supporting types are exported by name from the package.

### adapter

Implements `RouterAdapterInterface`. When the adapter is set, the default router is reset using the new adapter. See the [Router docs](/router/index.html) for details.

### middlewares

Implements `MiddlewareRouterInterface`. Responsible for storing middleware handlers keyed by route id and returning the inbound/outbound pipelines for a given match.

### cors

Either `null` or an instance of `CorsInterface`. Controls CORS handling and preflight responses.

### urlParamsParser

Implements `ObjectParserInterface<Record<string, string>>`. Parses URL params from a matched route.

### searchParamsParser

Implements `ObjectParserInterface<URLSearchParams>`. Parses query string search params.

### formDataParser

Implements `ObjectParserInterface<FormData>`. Parses `FormData` request bodies.

### bodyParser

Implements `BodyParserInterface`. Parses request bodies. The default implementation delegates to the form data and search params parsers, so if you replace those you usually do not need to replace this one.

### schemaParser

Implements `SchemaParserInterface`. Parses and validates data against route schemas.

## Non-Swappable Fields

### docs

Readonly. Holds the documentation map used by the CLI tool.

### router

Technically assignable but it isn't recommended. Implements `RouterInterface`. See the [Router docs](/router/index.html).

### prefix

Technically assignable, but the recommended way to set the global prefix is through `Server.setGlobalPrefix`.

```ts
const server = new C.Server();
server.setGlobalPrefix("/api");
```

## Interfaces

All importable by name.

```ts
export interface RegistryInterface {
	adapter: RouterAdapterInterface;
	router: RouterInterface;
	docs: Map<string, RegistryDocEntry>;
	cors: CorsInterface | null;
	prefix: string;
	middlewares: MiddlewareRouterInterface;
	urlParamsParser: ObjectParserInterface<Record<string, string>>;
	searchParamsParser: ObjectParserInterface<URLSearchParams>;
	formDataParser: ObjectParserInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
	reset(): void;
}

export type RegistryDocEntry = {
	id: string;
	endpoint: string;
	method: string;
	model: RouteModel<any, any, any, any> | undefined;
};

export interface RouterAdapterInterface {
	readonly __brand: string;
	find(req: Req): RouterReturn | null;
	add(data: RouterData): void;
	list: Func<[], Array<RouterData>> | undefined;
}

export interface RouterInterface {
	add(route: BaseRoute<any, any, any, any>): void;
	find(req: Req): RouterReturn | null;
	list(): Array<RouterData>;
}

export interface CorsInterface extends Middleware {
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: RequestHandler;
}

export interface MiddlewareRouterInterface {
	add(middleware: Middleware): void;
	find(routeId: string): MiddlewareRouterReturn;
}

export interface ObjectParserInterface<T> {
	parse(input: T): Record<string, unknown>;
}

export interface BodyParserInterface {
	parse(
		r: Req | Res | Response,
	): Promise<Record<string, unknown> | Array<unknown> | string | ReadableStream<Uint8Array>>;
}

export interface SchemaParserInterface {
	parse<T = Record<string, unknown>>(
		label: string,
		data: unknown,
		validate?: SchemaValidator<T>,
	): Promise<T>;
	parseSync<T = Record<string, unknown>>(
		label: string,
		data: unknown,
		validate?: SchemaValidator<T>,
	): T;
}
```

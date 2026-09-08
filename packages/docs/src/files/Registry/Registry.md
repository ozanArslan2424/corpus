# Registry

The `Registry` class is NOT part of the public Corpus API. It is the global container that holds every runtime dependency Corpus uses — the router, adapter, middleware router, entity store, parsers, [Cors](/Cors.html), and the global prefix. The registry is _plug & play_, so you can swap any of its fields with your own implementation as long as you satisfy the corresponding interface.

The registry instance can be accessed through `$registry`. Note that `$registry` itself cannot be reassigned — only its fields can be swapped.

Each [Route](/Route.html), [StaticRoute](/Route/StaticRoute.html), [WebSocketRoute](/Route/WebSocketRoute.html), [Controller](/Controller.html), and [Middleware](/Middleware.html) object registers itself into the global registry at construction time. This means any field you intend to replace must be swapped _before_ those objects are constructed, otherwise registrations will land on the old instance. Making all replacements at the top of your app would be a safe bet.

All interfaces can be imported by name, they are not namespaced to C or X.

<section class="table-of-contents">

##### Contents

1. [Plug & Play](#plug-and-play)
2. [Swappable Fields](#swappable-fields)
3. [Non-Swappable Fields](#non-swappable-fields)

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

Implements `RouterAdapterInterface`. When the adapter is set, the default router is reset using the new adapter. See the [Router docs](/Router.html) for details.

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

Technically assignable but it isn't recommended. Implements `RouterInterface`. See the [Router docs](/Router.html).

### prefix

Technically assignable, but the recommended way to set the global prefix is through `Server.setGlobalPrefix`.

```ts
const server = new C.Server();
server.setGlobalPrefix("/api");
```

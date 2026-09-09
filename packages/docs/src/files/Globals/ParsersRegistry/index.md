# ParsersRegistry

The single place every parsing decision in the framework is resolved from —
and the single place to replace them.

Nothing in corpus constructs a parser inline. `App` resolves the
registry while compiling routes, and `BodyParser` reaches back into it
for `FormDataParser` and `SearchParamsParser` rather than owning
instances of its own. Replacing an entry therefore changes how the whole
framework parses that surface, across every `RouteBase` on every
`App`, without touching a single route definition.

Every slot is plug and play. Each is typed as an interface
(`ParserBaseInterface`, [BodyParserInterface](../../ParserBase/BodyParser/index.md#bodyparserinterface),
[SchemaParserInterface](../../ParserBase/SchemaParser/index.md#schemaparserinterface)), never as a concrete class, so a replacement
only has to satisfy the contract — subclassing the default is optional.

```ts
// Replace one parser; the rest keep their defaults.
setParsersRegistry({ bodyParser: new MyBodyParser() });

await app.listen();
```

Overrides must be in place before [App.listen](../../App/index.md#app-listen): routes read the registry
as they are compiled, so anything swapped in afterwards is never reached.

The registry lives on `Globals`, so it is created once per process and
shared by every `App`.

<section class="table-of-contents">

##### Contents

1. [ParsersRegistry](#parsersregistry)
2. [getOrInitParsersRegistry](#getorinitparsersregistry)
3. [setParsersRegistry](#setparsersregistry)

</section>

## ParsersRegistry

_interface_

```ts
interface ParsersRegistry
```

The set of parsers the framework resolves at request time. Every field is an
interface, so each one can be replaced independently through
[setParsersRegistry](#setparsersregistry).

| Name                 | Description                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `urlParamsParser`    | Turns the raw path parameters matched by a `RouteBase` into [Context.params](../../Context/index.md#context-params). Defaults to `URLParamsParser`.                                                 |
| `searchParamsParser` | Turns a query string into [Context.search](../../Context/index.md#context-search). Defaults to `SearchParamsParser`, which `BodyParser` also reuses for `application/x-www-form-urlencoded` bodies. |
| `formDataParser`     | Turns `multipart/form-data` into an object. Defaults to `FormDataParser` and is reached through `BodyParser` rather than called directly.                                                           |
| `bodyParser`         | Reads and decodes request and response bodies by content type. Defaults to `BodyParser`.                                                                                                            |
| `schemaParser`       | Validates already-parsed params, search and body against the schemas declared in a route's `Config`. Defaults to `SchemaParser`, which supports Zod and ArkType.                                    |

## getOrInitParsersRegistry

_function_

```ts
function getOrInitParsersRegistry(): ParsersRegistry;
```

Reads the registry from `Globals`, constructing the defaults on first
access.

Called by `App` during route compilation and by `BodyParser` when
it needs a sibling parser.

**Returns** — The shared `ParsersRegistry`.

## setParsersRegistry

_function_

```ts
function setParsersRegistry(overrides: Partial<ParsersRegistry>): void;
```

Overrides one or more parsers. Only the provided keys are replaced;
unspecified parsers keep their current implementation.

Must be called before [App.listen](../../App/index.md#app-listen) — routes resolve their parsers as
they are compiled, so a later override has no effect on an already-listening
app.

**Parameters**

- `overrides` — The `ParsersRegistry` entries to swap in. Each value need only satisfy its interface; it does not have to extend the default class.

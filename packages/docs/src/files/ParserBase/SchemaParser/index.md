# SchemaParser

Request validation against the schemas declared in a [RouteConfig](../../RouteBase/index.md#routeconfig).

Schemas are taken as [Standard Schema](https://standardschema.dev), so any
library implementing that spec works — Zod, Valibot, ArkType and others —
without corpus depending on any of them. The same interface also supplies the
inferred types that flow into `Context`, so declaring a schema both
validates the request and types the handler.

`App` calls this after each surface is parsed, so what a handler sees on
[Context.body](../../Context/index.md#context-body), [Context.search](../../Context/index.md#context-search) and [Context.params](../../Context/index.md#context-params) is
already validated. A failure raises [Status.UNPROCESSABLE_ENTITY](../../Res/index.md#status-unprocessable-entity) with a
message naming the offending fields, so the client is told what was wrong
rather than just that something was.

<section class="table-of-contents">

##### Contents

1. [SchemaParserInterface](#schemaparserinterface)
2. [SchemaParser](#schemaparser)
3. [Schema](#schema)
4. [InferSchemaIn](#inferschemain)
5. [InferSchemaOut](#inferschemaout)
6. [ValidationIssues](#validationissues)
7. [InferModel](#infermodel)

</section>

## SchemaParserInterface

_interface_

```ts
interface SchemaParserInterface
```

The public shape of a schema parser, implemented by `SchemaParser`.
Assign an alternative to [ParsersRegistry.schemaParser](../../Globals/ParsersRegistry/index.md#parsersregistry-schemaparser) to change how
validation failures are reported.

### SchemaParserInterface.parse()

```ts
parse<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): Promise<T>
```

Validates a value against a schema.

**Parameters**

- `label` — Names the surface being validated, for the error message.
- `input` — The value to validate.
- `schema` — The schema. Omitting it passes the value through unchanged.

**Returns** — The validated value.

### SchemaParserInterface.parseSync()

```ts
parseSync<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): T
```

Validates a value against a synchronous schema.

**Parameters**

- `label` — Names the surface being validated, for the error message.
- `input` — The value to validate.
- `schema` — The schema. Omitting it passes the value through unchanged.

**Returns** — The validated value.

## SchemaParser

_class_

```ts
class SchemaParser implements SchemaParserInterface
```

Default [SchemaParserInterface](#schemaparserinterface) implementation.

A missing schema is not an error — the value passes through untouched, which
is what makes [RouteConfig](../../RouteBase/index.md#routeconfig) entirely optional.

### SchemaParser.parse()

```ts
async parse<T = Record<string, unknown>>(label: string, data: unknown, schema?: Schema<T>, ): Promise<T>
```

Validates a value against a schema.

This is what `App` uses during the request lifecycle, since a schema
may validate asynchronously.

**Parameters**

- `label` — Names the surface being validated — `"body"`, `"search"` or `"params"` — and appears in the error message.
- `data` — The value to validate, already parsed from the request.
- `schema` — The schema from the route's [RouteConfig](../../RouteBase/index.md#routeconfig). Omitting it returns the data as-is.

**Returns** — The validated value, with whatever transformations the schema applies.

**Throws** — `Exception` with [Status.UNPROCESSABLE_ENTITY](../../Res/index.md#status-unprocessable-entity) when validation fails, carrying the rejected data as exception data.

### SchemaParser.parseSync()

```ts
parseSync<T = Record<string, unknown>>(label: string, data: unknown, schema?: Schema<T>): T
```

Validates a value without awaiting, for callers that cannot be async.

Whether a schema validates synchronously is not visible in its type, so it
is detected at runtime: a validator that returns a promise is rejected
outright rather than having its result silently used as a value.

**Parameters**

- `label` — Names the surface being validated, and appears in the error message.
- `data` — The value to validate.
- `schema` — The schema. Omitting it returns the data as-is.

**Returns** — The validated value.

**Throws** — `Error` when the schema validates asynchronously — use [SchemaParser.parse](#schemaparser-parse) instead.

**Throws** — `Exception` with [Status.UNPROCESSABLE_ENTITY](../../Res/index.md#status-unprocessable-entity) when validation fails.

### SchemaParser.issuesToErrorMessage()

```ts
issuesToErrorMessage(label: string, data: unknown, issues: ValidationIssues): string
```

Renders validation issues into the message sent to the client.

Each issue is reported as `in <label> <path> (received <value>): <message>`,
so a client can see which field failed and what it actually sent — a
schema's own message alone rarely says which field it came from. Path
segments are joined with dots, and the offending value is looked up by
walking the original data along that path. Issues with no path are global to
the surface and keep their message unadorned.

Override this to change the wording or to withhold the received values.

**Parameters**

- `label` — Names the surface being validated.
- `data` — The value that failed, walked to find each reported value.
- `issues` — The failures the schema reported.

**Returns** — One line per issue, newline-joined, or an empty string when there are none.

## Schema

_type_

```ts
type Schema<T = unknown> = StandardSchemaV1<unknown, T>;
```

Any Standard Schema validator producing `T`. This is the type
[RouteConfig](../../RouteBase/index.md#routeconfig) fields accept.

**Type parameters**

- `T` — What the schema validates to.

## InferSchemaIn

_type_

```ts
type InferSchemaIn<T extends Schema> = StandardSchemaV1.InferInput<T>;
```

The type a schema accepts as input, before transformation.

**Type parameters**

- `T` — The schema.

## InferSchemaOut

_type_

```ts
type InferSchemaOut<T extends Schema> = StandardSchemaV1.InferOutput<T>;
```

The type a schema produces after validation. This is what a route's
`Context` fields are typed as.

**Type parameters**

- `T` — The schema.

## ValidationIssues

_type_

```ts
type ValidationIssues = readonly StandardSchemaV1.Issue[];
```

The validation failures a schema reports.

## InferModel

_type_

```ts
type InferModel<T extends Record<string, any>> = {
	[K in keyof T as K extends "prototype" ? never : K]: T[K] extends RouteConfig<any, any, any, any>
		? Prettify<
				(T[K]["body"] extends Schema ? { body: InferSchemaOut<T[K]["body"]> } : {}) &
					(T[K]["search"] extends Schema ? { search: InferSchemaOut<T[K]["search"]> } : {}) &
					(T[K]["params"] extends Schema ? { params: InferSchemaOut<T[K]["params"]> } : {}) &
					(T[K]["response"] extends Schema ? { response: InferSchemaOut<T[K]["response"]> } : {})
			>
		: T[K] extends Schema
			? InferSchemaOut<T[K]>
			: never;
};
```

If you prefer to put all schemas into a single object, this will be helpful

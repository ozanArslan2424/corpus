# BodyParser

Content-type-driven body reading for requests and responses alike.

`BodyParser` is the implementation behind
[`ParsersRegistry.bodyParser`](../ParsersRegistry/index.md#parsersregistry-bodyparser), which `App` uses to fill
[`Context.body`](../Context/index.md#context-body). It classifies the `Content-Type` header, then delegates
structured payloads to `SearchParamsParser` and `FormDataParser`
through the registry, so nesting and coercion rules stay identical across
query strings, form posts and JSON.

## BodyParserInterface

_interface_

```ts
interface BodyParserInterface
```

The public shape of a body parser, implemented by `BodyParser`.

Assign an alternative implementation to
[`ParsersRegistry.bodyParser`](../ParsersRegistry/index.md#parsersregistry-bodyparser) through [`setParsersRegistry`](../ParsersRegistry/index.md#setparsersregistry) to
replace body handling framework-wide.

### BodyParserInterface.parse()

```ts
parse(received: Request | Response | Res): Promise<ParsedBody>
```

Reads and decodes a body according to its `Content-Type`.

**Parameters**

- `received` — The request, response or `Res` to read from.

**Returns** — The decoded body.

## BodyParser

_class_

```ts
class BodyParser implements BodyParserInterface
```

Default [`BodyParserInterface`](#bodyparserinterface) implementation.

Reads are non-destructive for caller-supplied inputs: the body is cloned
before being drained, so a `Middleware` can inspect a body and still
leave it readable downstream. Empty bodies resolve to a null-prototype object
from `createSafeObject` rather than a plain `{}`, which is what keeps a
`__proto__` key in a payload from reaching `Object.prototype`.

### BodyParser.parse()

```ts
async parse(received: Request | Response | Res): Promise<ParsedBody>
```

Reads a body and decodes it according to its `Content-Type`. This can be
used for both request and response bodies.

A `Res` is converted with [`Res.toNativeResponse`](../Res/index.md#res-tonativeresponse) first. The
content type is read from that source rather than from the clone, because
Bun derives it lazily for `FormData`-backed requests and a clone taken
before the derivation does not carry it. The clone itself is skipped for a
`Res`-derived response, which is freshly constructed and unshared.

**Parameters**

- `received` — The request, response or `Res` whose body to read.

**Returns** — The decoded `ParsedBody`. A body-less input yields an empty safe object.

**Throws** — `Exception` with [`Status.BAD_REQUEST`](../Res/index.md#status-bad-request) when the payload is malformed for its declared type — a `SyntaxError` from decoding is attributed to the client, and the offending content type is attached to the exception. Any other error propagates unchanged.

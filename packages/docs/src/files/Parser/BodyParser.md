# BodyParser

`BodyParser` is the default implementation of `BodyParserInterface` and lives in the registry, so it can be replaced with a custom implementation. It turns a request or response body into a usable value based on the `Content-Type` header: parsed objects for structured types, strings for text, raw streams for binary. It can also enforce a maximum body size and reject oversized payloads with a 413.

The same instance handles both directions: `parse` accepts a `Req`, a `Res`, or a plain web `Response`.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Content Type Resolution](#content-type-resolution)
3. [Parse Behavior](#parse-behavior)
4. [Body Size Limit](#body-size-limit)
5. [Constructor Parameters](#constructor-parameters)
6. [Methods](#methods)

</section>

## Usage

You normally don't call the body parser directly. It runs as part of the request lifecycle and its result is what you receive as `c.body` in route handlers. Reference it when you want to understand what `c.body` will contain for a given `Content-Type`, or when replacing it with your own `BodyParserInterface` implementation through the [Registry](/registry.html).

## Content Type Resolution

The `Content-Type` header is matched by substring, first hit wins, in this order:

| Header contains                     | Resolved as                 |
| ----------------------------------- | --------------------------- |
| `application/json`                  | `json`                      |
| `application/x-www-form-urlencoded` | `form-urlencoded`           |
| `multipart/form-data`               | `form-data`                 |
| `text/plain`                        | `text`                      |
| `application/xml`, `text/xml`       | `xml`                       |
| `application/octet-stream`          | `binary`                    |
| `application/pdf`                   | `pdf`                       |
| `image/`, `audio/`, `video/`        | `image` / `audio` / `video` |
| anything else or missing            | `unknown`                   |

`binary`, `pdf`, `image`, `audio`, and `video` are stream types: their bodies are handed to the handler as raw streams and are never buffered by the parser.

## Parse Behavior

### Methods without a body

For requests, only `POST`, `PUT`, `PATCH`, and `DELETE` bodies are parsed. Any other method (`GET`, `HEAD`, `OPTIONS`, ...) returns an empty object without touching the body. Responses have no method, so they are always parsed.

### Per type

| Resolved type                              | Result                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `json`                                     | `input.json()`, an object or array                                           |
| `form-urlencoded`                          | Body text fed through `URLSearchParams`, then the search params parser       |
| `form-data`                                | `input.formData()`, then the form data parser                                |
| `text`, `xml`                              | The body as a string, decoded per the charset rules below                    |
| `binary`, `pdf`, `image`, `audio`, `video` | The raw `ReadableStream<Uint8Array>`, or an empty object if the body is null |
| `unknown`                                  | Read as text; if it parses as JSON, the parsed value, otherwise the string   |

Structured results (`form-urlencoded`, `form-data`) go through the registered [SearchParamsParser](/search-params-parser.html) and [FormDataParser](/form-data-parser.html), so their value coercion rules apply.

### Charset handling

Per the fetch spec, `Body.text()` always decodes as UTF-8 and ignores the `Content-Type` charset, so the parser handles it explicitly. When the `charset` parameter is missing or UTF-8, the body is read with `text()` directly. Any other charset is decoded with a `TextDecoder` for that label (`iso-8859-1`, `windows-1252`, and every other label `TextDecoder` supports). Unknown charset labels fall back to UTF-8 instead of throwing.

### Error handling

A `SyntaxError` during parsing (invalid JSON, an empty `form-urlencoded` body) resolves to an empty object instead of throwing. All other errors, including the 413 from the body size limit, propagate. The empty object is prototype-less (`Object.create(null)`).

## Body Size Limit

`parse` takes an optional `maxRequestBodySize` in bytes. When omitted, nothing is limited and nothing extra is buffered. When set, bodies over the limit throw an `Exception` with status `413`, which propagates through the lifecycle like any other `Exception`.

Enforcement is two-layered: a declared `Content-Length` above the limit is rejected before reading anything, and the body stream is byte-counted while buffering so chunked, undeclared, or lying clients are caught as soon as the limit is crossed, at which point the stream is cancelled.

The limit applies to every parsed type, including `multipart/form-data`. Stream types are exempt: their bodies pass through as raw streams without buffering, so consuming them (and bounding them) is the handler's responsibility. A body of exactly the limit is accepted; the first byte past it is not.

## Constructor Parameters

### formDataParser

`ObjectParserInterface<FormData>`

The parser that converts `FormData` into a plain object. The registry provides [FormDataParser](/form-data-parser.html) by default.

### searchParamsParser

`ObjectParserInterface<URLSearchParams>`

The parser that converts `URLSearchParams` into a plain object. The registry provides [SearchParamsParser](/search-params-parser.html) by default.

## Methods

### parse

`parse(r: Req | Res | Response, maxRequestBodySize?: number): Promise<Record<string, unknown> | Array<unknown> | string | ReadableStream<Uint8Array>>`

Resolves the content type and returns the parsed body per the rules above, enforcing `maxRequestBodySize` when provided. `Req` and `Res` are unwrapped to their underlying web `Request`/`Response` before parsing.

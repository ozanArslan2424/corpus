# SchemaParser

`SchemaParser` is the default `SchemaParserInterface` implementation in the registry. It runs the validators from a [route model](/Parser/Model.html) against parsed request data (body, search params, URL params) and the response, returning the typed value on success and throwing a `422` `Exception` with a readable message on failure.

Validators follow the standard schema shape: a function that returns `{ value }` on success or `{ issues }` on failure, so any standard schema library (zod, valibot, arktype, ...) works.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Error Messages](#error-messages)
3. [Methods](#methods)

</section>

## Usage

You normally don't call it directly; it runs in the request lifecycle for every schema present in a route's model. Replace it with your own `SchemaParserInterface` implementation through the [Registry](/Registry.html) to change validation or error formatting behavior globally.

When no validator is provided, the data passes through unchanged (typed by cast, not checked).

## Error Messages

Validation failures throw an `Exception` with status `422` (Unprocessable Entity), the offending data attached as the exception data, and a message built from the issues, one line per issue:

```
in body user.email (received "not-an-email"): Invalid email
```

The format is `in {label} {path} (received {value}): {message}` where `label` names the validated part (`body`, `search`, `params`, `response`), the path segments are joined with dots, and the received value is looked up from the input data and JSON-stringified. Issues without a path (global/root issues) use the issue message as-is. The `(received ...)` part is omitted when the value at the path is `undefined`.

## Methods

### parse

`parse<T>(label: string, data: unknown, validate?: SchemaValidator<T>): Promise<T>`

Validates asynchronously. Supports both sync and async validators. Returns the validated (and possibly transformed) value, or throws the `422` `Exception` described above. Without a validator, returns the data as-is.

### parseSync

`parseSync<T>(label: string, data: unknown, validate?: SchemaValidator<T>): T`

Same as `parse` but synchronous. Throws an `Error` (not an `Exception`) if the validator turns out to be async, since the result can't be awaited: use a sync schema library or switch to `parse`.

### issuesToErrorMessage

`issuesToErrorMessage(label: string, data: unknown, issues: ValidationIssues): string`

Builds the error message described in [Error Messages](#error-messages). Exposed so custom implementations or middleware can reuse the formatting. Returns an empty string for an empty issues array.

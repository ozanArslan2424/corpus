# ParserBase

The shared base for the input parsers that turn flat key/value pairs into
nested objects.

`URLParamsParser`, `SearchParamsParser` and
`FormDataParser` all face the same problem: a source that only carries
strings paired with strings, where structure has to be recovered from the key
itself and types from the value. `ParserBase` supplies both halves —
[ParserBase.parseKey](#parserbase-parsekey) for the bracket notation and
[ParserBase.tryParseJSON](#parserbase-tryparsejson) for value coercion — so the three agree on
what `user[roles][0]=admin` means regardless of which surface it arrived on.

Subclass it to add a parser of your own, then register it through
[setParsersRegistry](../Globals/ParsersRegistry/index.md#setparsersregistry).

<section class="table-of-contents">

##### Contents

1. [ParserBase](#parserbase)

</section>

## ParserBase

_class_

```ts
abstract class ParserBase<T>implements ParserBaseInterface<T>
```

Base class for the input parsers.

It provides the key and value handling; each subclass supplies
[ParserBase.parse](#parserbase-parse) for its own source and does the writing, since how
repeated keys collect differs between a query string and a form.

**Type parameters**

- `T` — The input the parser accepts.

### ParserBase.parse()

```ts
abstract parse(input: T): Record<string, unknown>;
```

Converts the input into a nested object. Implemented per source.

**Parameters**

- `input` — The source to parse.

**Returns** — The parsed object.

### ParserBase.newContainer()

```ts
protected newContainer(current: unknown): Record<string | number, unknown>
```

Narrows a value to an indexable container so a path segment can be written
into it.

Purely a readability helper for the traversal loops — the value is used
as-is, nothing is constructed.

**Parameters**

- `current` — The level currently being written into.

**Returns** — The same value, typed for index access.

### ParserBase.parseKey()

```ts
protected parseKey(key: string):(string | number)[]
```

Splits a key into the path it describes.

Dot and bracket notation are treated as equivalent, so `a[0].b[1][c]` and
`a.0.b.1.c` both yield `["a", 0, "b", 1, "c"]`. A purely numeric segment
becomes a number, which is how the subclasses know to create an array rather
than an object at that level — subject to `ARRAY_INDEX_LIMIT`, above
which the segment stays a string key.

**Parameters**

- `key` — The raw field name.

**Returns** — The path segments: numbers for array indices, strings for object keys.

### ParserBase.tryParseJSON()

```ts
protected tryParseJSON(value: string): unknown
```

Coerces a raw string value into whatever it represents.

Since every value from these sources arrives as a string, `"42"`, `"true"`
and `"null"` are decoded to their JSON equivalents. Anything that is not
valid JSON — ordinary text, most of the time — is returned unchanged rather
than treated as an error.

**Parameters**

- `value` — The raw string value.

**Returns** — The decoded value, or the original string.

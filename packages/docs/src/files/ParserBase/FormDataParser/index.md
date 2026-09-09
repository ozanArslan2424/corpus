# FormDataParser

Parsing `multipart/form-data` into a nested object.

`FormDataParser` is the default [ParsersRegistry.formDataParser](../../Globals/ParsersRegistry/index.md#parsersregistry-formdataparser),
reached through `BodyParser` rather than called directly. It applies the
same bracket-notation nesting as `SearchParamsParser`, so a form post
and a query string with matching field names produce the same shape — the
difference is that a form can also carry files, which are kept as `File`
objects instead of being coerced.

<section class="table-of-contents">

##### Contents

1. [FormDataParser](#formdataparser)

</section>

## FormDataParser

_class_

```ts
class FormDataParser extends ParserBase<FormData>
```

Turns a `FormData` into a nested object.

Field names are read as paths through [ParserBase.parseKey](../index.md#parserbase-parsekey), so
`user[address][city]` and `tags[0]` build the objects and arrays they
describe. Repeated names collect into an array, which is how a multi-select or
a multi-file input arrives without any bracket notation at all.

Values are coerced through [ParserBase.tryParseJSON](../index.md#parserbase-tryparsejson), so `"true"` and
`"42"` arrive as a boolean and a number rather than as strings. Files are
exempt — a `File` is passed through untouched.

### FormDataParser.parse()

```ts
parse(formData: FormData): Record<string, unknown>
```

Parses form data into a nested object.

**Parameters**

- `formData` — The form data to parse, typically from `Request.formData()`.

**Returns** — The nested object, built on a null prototype by `createSafeObject` so a `__proto__` field name cannot reach `Object.prototype`.

# URLParamsParser

Parsing path parameters into typed values.

`URLParamsParser` is the default
[ParsersRegistry.urlParamsParser](../../Globals/ParsersRegistry/index.md#parsersregistry-urlparamsparser). It fills [Context.params](../../Context/index.md#context-params) from
the raw values Bun's router matched, decoding and coercing each one.

<section class="table-of-contents">

##### Contents

1. [URLParamsParser](#urlparamsparser)

</section>

## URLParamsParser

_class_

```ts
class URLParamsParser extends ParserBase<Record<string, string>>
```

Turns matched path parameters into a typed object.

The flattest of the parsers: path parameters are named by the route pattern,
so there is no nesting to recover — no bracket notation, no repeated keys.
Each value is percent-decoded and then coerced through
[ParserBase.tryParseJSON](../index.md#parserbase-tryparsejson), so `/users/42` yields a number rather than a
string.

### URLParamsParser.parse()

```ts
parse(input: Record<string, string>): Record<string, unknown>
```

Parses matched path parameters.

**Parameters**

- `input` — The raw parameters from the router, including the `*` key that `App` lifts out of a wildcard endpoint.

**Returns** — The decoded, coerced parameters, on a null prototype from `createSafeObject`.

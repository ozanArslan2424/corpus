# SearchParamsParser

Parsing a query string into a nested object.

`SearchParamsParser` is the default
[`ParsersRegistry.searchParamsParser`](../ParsersRegistry/index.md#parsersregistry-searchparamsparser). It fills [`Context.search`](../Context/index.md#context-search),
and `BodyParser` also routes `application/x-www-form-urlencoded` bodies
through it, so a query string and a form post with matching field names
produce the same shape.

## SearchParamsParser

_class_

```ts
class SearchParamsParser extends ParserBase<URLSearchParams>
```

Turns `URLSearchParams` into a nested object.

Keys are read as paths through [`ParserBase.parseKey`](../ParserBase/index.md#parserbase-parsekey), so
`?filter[status]=open&tags[0]=a` builds the objects and arrays it describes.
Repeated keys collect into an array, which is how `?tag=a&tag=b` arrives
without any bracket notation.

Values are coerced through [`ParserBase.tryParseJSON`](../ParserBase/index.md#parserbase-tryparsejson), so `?page=2` and
`?active=true` arrive as a number and a boolean rather than as strings.

### SearchParamsParser.parse()

```ts
parse(searchParams: URLSearchParams): Record<string, unknown>
```

Parses a query string into a nested object.

**Parameters**

- `searchParams` — The parameters to parse.

**Returns** — The nested object, built on a null prototype by `createSafeObject` so a `__proto__` key in the query string cannot reach `Object.prototype`.

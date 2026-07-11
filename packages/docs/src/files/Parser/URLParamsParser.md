# URLParamsParser

`URLParamsParser` is the default `ObjectParserInterface<Record<string, string>>` implementation in the registry and extends [ObjectParserAbstract](/object-parser-abstract.html). It converts the raw URL parameters matched by the router (`:id`, `:slug`, ...) into a plain object with decoded and coerced values. Its output is `c.params` in route handlers.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Behavior](#behavior)

</section>

## Usage

You normally don't call it directly. For a route `GET /users/:id/posts/:slug` and a request to `/users/5/posts/hello%20world`, `c.params` becomes:

```ts
{
	id: 5,
	slug: "hello world",
}
```

Replace it with your own implementation through the [Registry](/registry.html).

## Behavior

Parameters are flat: keys come from the route definition, so there is no bracket/dot nesting. Each value is `decodeURIComponent`-ed and then coerced with `tryParseJSON`:

| Path segment    | Parsed as                |
| --------------- | ------------------------ |
| `5`             | `5` (number)             |
| `true`          | `true` (boolean)         |
| `hello`         | `"hello"` (string)       |
| `hello%20world` | `"hello world"` (string) |

Note the coercion consequence: `/users/5` gives `c.params.id` as a number while `/users/abc` gives a string. If a param must always be one type, validate it with the `params` schema in the [route model](/model.html).

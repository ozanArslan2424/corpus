# FormDataParser

`FormDataParser` is the default `ObjectParserInterface<FormData>` implementation in the registry and extends [ObjectParserAbstract](/object-parser-abstract.html). It converts multipart form data into a nested plain object with coerced values. [BodyParser](/body-parser.html) runs it for `multipart/form-data` request bodies, so its output is what arrives as `c.body` for form submissions.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Key Notation](#key-notation)
3. [Value Handling](#value-handling)
4. [Repeated Keys](#repeated-keys)

</section>

## Usage

You normally don't call it directly; it runs inside the body parsing step. Given a form with these entries:

```
title        = "hello"
count        = "5"
items[0][id] = "1"
items[1][id] = "2"
avatar       = (File)
```

`c.body` becomes:

```ts
{
	title: "hello",
	count: 5,
	items: [{ id: 1 }, { id: 2 }],
	avatar: File,
}
```

Replace it with your own implementation through the [Registry](/registry.html).

## Key Notation

Keys are split into path segments with bracket/dot notation via `parseKey`, and the value is written at that path. Purely numeric segments become array indices.

| Key              | Writes to              |
| ---------------- | ---------------------- |
| `title`          | `result.title`         |
| `user.name`      | `result.user.name`     |
| `items[0]`       | `result.items[0]`      |
| `items[0][name]` | `result.items[0].name` |
| `a[0].b[1][c]`   | `result.a[0].b[1].c`   |

Intermediate containers are created on demand: an array when the next segment is numeric, otherwise a prototype-less object. The result root is prototype-less as well, so hostile keys like `__proto__` land as plain own properties.

## Value Handling

`File` entries are preserved as-is. Every other entry is a string and goes through `tryParseJSON`, so values that are valid JSON are coerced:

| Entry value | Parsed as          |
| ----------- | ------------------ |
| `"5"`       | `5` (number)       |
| `"true"`    | `true` (boolean)   |
| `"null"`    | `null`             |
| `"[1,2]"`   | `[1, 2]` (array)   |
| `"hello"`   | `"hello"` (string) |

Coercion follows JSON rules exactly: `"007"` stays a string (leading zeros are invalid JSON), `"1e3"` becomes `1000`.

## Repeated Keys

Writing to a slot that already holds a value promotes it to an array; further writes append.

```
ids = "1"        → { ids: 1 }
ids = "2"        → { ids: [1, 2] }
ids = "3"        → { ids: [1, 2, 3] }
```

This means a field's type depends on how many times it appears: once gives the value, twice gives an array. Validate with a schema if the shape must be stable.

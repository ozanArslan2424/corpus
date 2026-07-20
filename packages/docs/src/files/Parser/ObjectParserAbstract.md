# ObjectParserAbstract

`ObjectParserAbstract<T>` is the base class for parsers that turn a key-value input (like `FormData` or `URLSearchParams`) into a plain object. It implements `ObjectParserInterface<T>` and provides the shared helpers for key parsing, value coercion, and safe object creation. [FormDataParser](/Parser/FormDataParser.html), [SearchParamsParser](/Parser/SearchParamsParser.html), and [URLParamsParser](/Parser/URLParamsParser.html) all extend it.

Extend it when writing a custom parser to replace one of the defaults through the [Registry](/Registry.html), or to parse a new input shape with the same key and value semantics.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Abstract Methods](#abstract-methods)
3. [Protected Helpers](#protected-helpers)

</section>

## Usage

Subclasses implement `parse` and build their result with the protected helpers:

```ts
import { C } from "@ozanarslan/corpus";

class HeaderObjectParser extends C.ObjectParserAbstract<Headers> {
	parse(input: Headers): Record<string, unknown> {
		const result = this.newSafeObject();
		input.forEach((value, key) => {
			result[key] = this.tryParseJSON(value);
		});
		return result;
	}
}
```

## Abstract Methods

### parse

`parse(input: T): Record<string, unknown>`

Converts the input into a plain object. This is the only method a subclass must implement.

## Protected Helpers

### newSafeObject

`newSafeObject(): Record<string, unknown>`

Returns a prototype-less object (`Object.create(null)`). Using it as the result root means keys like `__proto__` or `constructor` in user input land as plain own properties instead of touching the prototype chain. The built-in parsers use it for nested intermediate containers as well, so the protection covers the whole result tree.

### newContainer

`newContainer(current: unknown): Record<string | number, unknown>`

Casts a value to an indexable container for building nested structures. A typing convenience for subclasses that write into intermediate objects and arrays.

### parseKey

`parseKey(key: string): (string | number)[]`

Splits a bracket/dot notation key into its path segments. Purely numeric segments become numbers, which subclasses use as array indices.

| Input            | Output                  |
| ---------------- | ----------------------- |
| `"a[0].b[1][c]"` | `["a", 0, "b", 1, "c"]` |
| `"items[2]"`     | `["items", 2]`          |
| `"user.name"`    | `["user", "name"]`      |
| `"plain"`        | `["plain"]`             |

### tryParseJSON

`tryParseJSON(value: string): unknown`

Attempts `JSON.parse` on the value and returns the raw string if it fails. This is where the value coercion in the built-in parsers comes from: `"5"` becomes `5`, `"true"` becomes `true`, `"{"a":1}"` becomes an object, and anything that isn't valid JSON stays a string.

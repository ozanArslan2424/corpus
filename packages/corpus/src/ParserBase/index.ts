/**
 * The shared base for the input parsers that turn flat key/value pairs into
 * nested objects.
 *
 * {@link URLParamsParser}, {@link SearchParamsParser} and
 * {@link FormDataParser} all face the same problem: a source that only carries
 * strings paired with strings, where structure has to be recovered from the key
 * itself and types from the value. {@link ParserBase} supplies both halves —
 * {@link ParserBase.parseKey} for the bracket notation and
 * {@link ParserBase.tryParseJSON} for value coercion — so the three agree on
 * what `user[roles][0]=admin` means regardless of which surface it arrived on.
 *
 * Subclass it to add a parser of your own, then register it through
 * {@link setParsersRegistry}.
 *
 * @module ParserBase
 */

/**
 * The public shape of an input parser. This is the type
 * {@link ParsersRegistry.urlParamsParser}, {@link ParsersRegistry.searchParamsParser}
 * and {@link ParsersRegistry.formDataParser} hold, so a replacement need only
 * satisfy the contract rather than extend {@link ParserBase}.
 *
 * @typeParam T - The input the parser accepts — `URLSearchParams`, `FormData`,
 * or a record of raw path parameters.
 */
interface ParserBaseInterface<T> {
	/**
	 * Converts the input into a nested object.
	 *
	 * @param input - The source to parse.
	 * @returns The parsed object.
	 */
	parse(input: T): Record<string, unknown>;
}

/**
 * Bracket segments that parse as an integer become array indices, so
 * `a[999999999]=1` would otherwise produce a billion-length array whose
 * JSON serialization is gigabytes of `null,` — a 15-byte body that OOMs
 * the process. Past this bound the segment stays a string key, and the
 * container is built as a plain object instead of an array.
 */
const ARRAY_INDEX_LIMIT = 1_000;

/**
 * Base class for the input parsers.
 *
 * It provides the key and value handling; each subclass supplies
 * {@link ParserBase.parse} for its own source and does the writing, since how
 * repeated keys collect differs between a query string and a form.
 *
 * @typeParam T - The input the parser accepts.
 */
abstract class ParserBase<T> implements ParserBaseInterface<T> {
	/**
	 * Converts the input into a nested object. Implemented per source.
	 *
	 * @param input - The source to parse.
	 * @returns The parsed object.
	 */
	abstract parse(input: T): Record<string, unknown>;

	/**
	 * Narrows a value to an indexable container so a path segment can be written
	 * into it.
	 *
	 * Purely a readability helper for the traversal loops — the value is used
	 * as-is, nothing is constructed.
	 *
	 * @param current - The level currently being written into.
	 * @returns The same value, typed for index access.
	 */
	protected newContainer(current: unknown): Record<string | number, unknown> {
		return current as Record<string | number, unknown>;
	}

	/**
	 * Splits a key into the path it describes.
	 *
	 * Dot and bracket notation are treated as equivalent, so `a[0].b[1][c]` and
	 * `a.0.b.1.c` both yield `["a", 0, "b", 1, "c"]`. A purely numeric segment
	 * becomes a number, which is how the subclasses know to create an array rather
	 * than an object at that level — subject to {@link ARRAY_INDEX_LIMIT}, above
	 * which the segment stays a string key.
	 *
	 * @param key - The raw field name.
	 * @returns The path segments: numbers for array indices, strings for object
	 * keys.
	 */
	protected parseKey(key: string): (string | number)[] {
		// split "a[0].b[1][c]" into ["a", 0, "b", 1, "c"]
		// "next" is used to assigned to correct index
		const parts: (string | number)[] = [];
		for (const part of key.split(/[.[\]]+/).filter(Boolean)) {
			if (!/^\d+$/.test(part)) {
				parts.push(part);
				continue;
			}
			const index = parseInt(part);
			parts.push(index <= ARRAY_INDEX_LIMIT ? index : part);
		}
		return parts;
	}

	/**
	 * Coerces a raw string value into whatever it represents.
	 *
	 * Since every value from these sources arrives as a string, `"42"`, `"true"`
	 * and `"null"` are decoded to their JSON equivalents. Anything that is not
	 * valid JSON — ordinary text, most of the time — is returned unchanged rather
	 * than treated as an error.
	 *
	 * @param value - The raw string value.
	 * @returns The decoded value, or the original string.
	 */
	protected tryParseJSON(value: string): unknown {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
}

export { type ParserBaseInterface, ParserBase };

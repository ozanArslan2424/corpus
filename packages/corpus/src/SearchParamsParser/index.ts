/**
 * Parsing a query string into a nested object.
 *
 * {@link SearchParamsParser} is the default
 * {@link ParsersRegistry.searchParamsParser}. It fills {@link Context.search},
 * and {@link BodyParser} also routes `application/x-www-form-urlencoded` bodies
 * through it, so a query string and a form post with matching field names
 * produce the same shape.
 *
 * @module SearchParamsParser
 */

import { ParserBase } from "@/ParserBase";
import { createSafeObject } from "@/utils/object";

/**
 * Turns `URLSearchParams` into a nested object.
 *
 * Keys are read as paths through {@link ParserBase.parseKey}, so
 * `?filter[status]=open&tags[0]=a` builds the objects and arrays it describes.
 * Repeated keys collect into an array, which is how `?tag=a&tag=b` arrives
 * without any bracket notation.
 *
 * Values are coerced through {@link ParserBase.tryParseJSON}, so `?page=2` and
 * `?active=true` arrive as a number and a boolean rather than as strings.
 */
class SearchParamsParser extends ParserBase<URLSearchParams> {
	/**
	 * Parses a query string into a nested object.
	 *
	 * @param searchParams - The parameters to parse.
	 * @returns The nested object, built on a null prototype by
	 * {@link createSafeObject} so a `__proto__` key in the query string cannot
	 * reach `Object.prototype`.
	 */
	parse(searchParams: URLSearchParams): Record<string, unknown> {
		const result = createSafeObject();

		searchParams.forEach((entry, key) => {
			const parts = this.parseKey(key);
			const value = this.tryParseJSON(entry);
			this.setDeep(result, parts, value);
		});

		return result;
	}

	/**
	 * Writes a value at a path, creating the containers it passes through.
	 *
	 * Each missing level is created as an array when the next path part is a
	 * number and as an object otherwise, so the shape follows the key rather than
	 * being guessed after the fact. A scalar already occupying a level that must
	 * be descended into is replaced — query strings are client-controlled and
	 * arrive in arbitrary order, so `?a=1&a[b]=2` is resolved by letting the
	 * structured key win rather than throwing.
	 *
	 * The final slot collects rather than overwrites: an empty slot takes the
	 * value, a slot already holding an array appends, and a slot holding a single
	 * value is promoted to an array. That is what makes repeated keys accumulate,
	 * in arrival order.
	 *
	 * Deliberately kept separate from {@link FormDataParser}'s near-identical
	 * method: the two sources differ in what they can carry, and sharing the code
	 * would tie their behaviour together.
	 *
	 * @param result - The object being built up.
	 * @param parts - The path from {@link ParserBase.parseKey}; numbers mean array
	 * indices, strings mean object keys.
	 * @param value - The value to write, already coerced.
	 */
	private setDeep(result: Record<string, unknown>, parts: (string | number)[], value: unknown) {
		// same as formdata but good to keep separate
		let current = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]!;
			const next = parts[i + 1];
			// just for readability, current can be used directly as well
			const container = this.newContainer(current);
			// each part needs an entry
			const isIndexAssigned = typeof next === "number";
			if (container[part] === undefined) {
				container[part] = isIndexAssigned ? [] : createSafeObject();
			} else if (typeof container[part] !== "object" || container[part] === null) {
				// scalar already sitting where we need to descend: replace it
				container[part] = isIndexAssigned ? [] : createSafeObject();
			}
			(current as unknown) = container[part];
		}

		const last = parts[parts.length - 1]!;
		const container = this.newContainer(current);
		const existing = container[last];

		if (existing === undefined) {
			// first write at this slot
			container[last] = value;
		} else if (Array.isArray(existing)) {
			// slot already holds an array, append
			container[last] = [...existing, value];
		} else {
			// slot holds a single value, promote to array
			container[last] = [existing, value];
		}
	}
}

export { SearchParamsParser };

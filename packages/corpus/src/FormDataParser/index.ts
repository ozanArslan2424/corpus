/**
 * Parsing `multipart/form-data` into a nested object.
 *
 * {@link FormDataParser} is the default {@link ParsersRegistry.formDataParser},
 * reached through {@link BodyParser} rather than called directly. It applies the
 * same bracket-notation nesting as {@link SearchParamsParser}, so a form post
 * and a query string with matching field names produce the same shape — the
 * difference is that a form can also carry files, which are kept as `File`
 * objects instead of being coerced.
 *
 * @module FormDataParser
 */

import { ParserBase } from "@/ParserBase";
import { createSafeObject } from "@/utils/object";

/**
 * Turns a `FormData` into a nested object.
 *
 * Field names are read as paths through {@link ParserBase.parseKey}, so
 * `user[address][city]` and `tags[0]` build the objects and arrays they
 * describe. Repeated names collect into an array, which is how a multi-select or
 * a multi-file input arrives without any bracket notation at all.
 *
 * Values are coerced through {@link ParserBase.tryParseJSON}, so `"true"` and
 * `"42"` arrive as a boolean and a number rather than as strings. Files are
 * exempt — a `File` is passed through untouched.
 */
class FormDataParser extends ParserBase<FormData> {
	/**
	 * Parses form data into a nested object.
	 *
	 * @param formData - The form data to parse, typically from
	 * `Request.formData()`.
	 * @returns The nested object, built on a null prototype by
	 * {@link createSafeObject} so a `__proto__` field name cannot reach
	 * `Object.prototype`.
	 */
	parse(formData: FormData): Record<string, unknown> {
		const result = createSafeObject();

		formData.forEach((entry, key) => {
			const parts = this.parseKey(key);
			const value = entry instanceof File ? entry : this.tryParseJSON(entry);
			this.setDeep(result, parts, value);
		});

		return result;
	}

	/**
	 * Writes a value at a path, creating the containers it passes through.
	 *
	 * Each missing level is created as an array when the next path part is a
	 * number and as an object otherwise, so the shape follows the field name
	 * rather than being guessed after the fact.
	 *
	 * The final slot collects rather than overwrites: an empty slot takes the
	 * value, a slot already holding an array appends, and a slot holding a single
	 * value is promoted to an array. That is what makes repeated field names
	 * accumulate — order of arrival is preserved.
	 *
	 * @param result - The object being built up.
	 * @param parts - The path from {@link ParserBase.parseKey}; numbers mean array
	 * indices, strings mean object keys.
	 * @param value - The value to write, already coerced or left as a `File`.
	 */
	private setDeep(result: Record<string, unknown>, parts: (string | number)[], value: unknown) {
		let current = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]!;
			const next = parts[i + 1];

			// just for readability, current can be used directly as well
			const container = this.newContainer(current);

			// each part needs an entry
			// container[part] is undefined so we assign it as inner container
			if (container[part] === undefined) {
				const isIndexAssigned = typeof next === "number";
				container[part] = isIndexAssigned ? [] : createSafeObject();
			}

			// if container[part] defined, it is a value assigned directly
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

export { FormDataParser };

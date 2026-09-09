/**
 * Parsing path parameters into typed values.
 *
 * {@link URLParamsParser} is the default
 * {@link ParsersRegistry.urlParamsParser}. It fills {@link Context.params} from
 * the raw values Bun's router matched, decoding and coercing each one.
 *
 * @module URLParamsParser
 */

import { ParserBase } from "@/ParserBase";
import { createSafeObject, objGetEntries } from "@/utils/object";

/**
 * Turns matched path parameters into a typed object.
 *
 * The flattest of the parsers: path parameters are named by the route pattern,
 * so there is no nesting to recover — no bracket notation, no repeated keys.
 * Each value is percent-decoded and then coerced through
 * {@link ParserBase.tryParseJSON}, so `/users/42` yields a number rather than a
 * string.
 */
class URLParamsParser extends ParserBase<Record<string, string>> {
	/**
	 * Parses matched path parameters.
	 *
	 * @param input - The raw parameters from the router, including the `*` key
	 * that {@link App} lifts out of a wildcard endpoint.
	 * @returns The decoded, coerced parameters, on a null prototype from
	 * {@link createSafeObject}.
	 */
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = createSafeObject();
		for (const [key, value] of objGetEntries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

export { URLParamsParser };

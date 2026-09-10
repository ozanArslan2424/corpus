/**
 * Content-type-driven body reading for requests and responses alike.
 *
 * {@link BodyParser} is the implementation behind
 * {@link ParsersRegistry.bodyParser}, which {@link App} uses to fill
 * {@link Context.body}. It classifies the `Content-Type` header, then delegates
 * structured payloads to {@link SearchParamsParser} and {@link FormDataParser}
 * through the registry, so nesting and coercion rules stay identical across
 * query strings, form posts and JSON.
 *
 * @module BodyParser
 */

import { Exception } from "@/Exception";
import { getOrInitParsersRegistry } from "@/Globals/ParsersRegistry";
import { HeaderKey } from "@/Headers";
import { Res, Status } from "@/Res";
import type { Nullable } from "@/utils/is";
import { createSafeObject } from "@/utils/object";

/**
 * The family a `Content-Type` header belongs to, as resolved by
 * {@link getContentTypeDisco}. Each value selects one of the read strategies on
 * {@link BodyParser}.
 */
type ContentTypeDisco = "json" | "form-urlencoded" | "form-data" | "text" | "xml" | "binary";

/**
 * What {@link BodyParser.parse} can produce.
 *
 * Structured types yield an object or an array, textual types a string, binary
 * types the undrained stream so it can be piped rather than buffered, and a
 * binary body that turned out to be absent yields `null`.
 */
type ParsedBody =
	| Record<string, unknown>
	| Array<unknown>
	| string
	| ReadableStream<Uint8Array>
	| null;

/**
 * The public shape of a body parser, implemented by {@link BodyParser}.
 *
 * Assign an alternative implementation to
 * {@link ParsersRegistry.bodyParser} through {@link setParsersRegistry} to
 * replace body handling framework-wide.
 */
interface BodyParserInterface {
	/**
	 * Reads and decodes a body according to its `Content-Type`.
	 *
	 * @param received - The request, response or {@link Res} to read from.
	 * @returns The decoded body.
	 */
	parse(received: Request | Response | Res): Promise<ParsedBody>;
}

/**
 * Ordered `Content-Type` patterns mapped to their {@link ContentTypeDisco}.
 *
 * The first match wins, so narrower patterns must precede broader ones.
 */
const CONTENT_TYPE_MAP: Array<[ContentTypeDisco, RegExp]> = [
	["json", /application\/json/],
	["form-urlencoded", /application\/x-www-form-urlencoded/],
	["form-data", /multipart\/form-data/],
	["text", /text\/plain/],
	["xml", /application\/xml|text\/xml/],
	["binary", /application\/octet-stream|application\/pdf|^image\/|^audio\/|^video\//],
];

/**
 * Classifies a raw `Content-Type` header value against {@link CONTENT_TYPE_MAP}.
 *
 * Matching is substring-based, so parameters such as `charset` or a multipart
 * `boundary` do not prevent a match.
 *
 * @param contentType - The full header value, parameters included.
 * @returns The matching {@link ContentTypeDisco}, or `null` when nothing matches
 * — which sends the body to {@link BodyParser.getUnknownBody}.
 */
function getContentTypeDisco(contentType: string): Nullable<ContentTypeDisco> {
	for (const [disco, pattern] of CONTENT_TYPE_MAP) {
		if (pattern.test(contentType)) return disco;
	}
	return null;
}

/**
 * Default {@link BodyParserInterface} implementation.
 *
 * Reads are non-destructive for caller-supplied inputs: the body is cloned
 * before being drained, so a {@link Middleware} can inspect a body and still
 * leave it readable downstream. Empty bodies resolve to a null-prototype object
 * from {@link createSafeObject} rather than a plain `{}`, which is what keeps a
 * `__proto__` key in a payload from reaching `Object.prototype`.
 */
class BodyParser implements BodyParserInterface {
	/**
	 * Reads a body and decodes it according to its `Content-Type`. This can be
	 * used for both request and response bodies.
	 *
	 * A {@link Res} is converted with {@link Res.toNativeResponse} first. The
	 * content type is read from that source rather than from the clone, because
	 * Bun derives it lazily for `FormData`-backed requests and a clone taken
	 * before the derivation does not carry it. The clone itself is skipped for a
	 * {@link Res}-derived response, which is freshly constructed and unshared.
	 *
	 * @param received - The request, response or {@link Res} whose body to read.
	 * @returns The decoded {@link ParsedBody}. A body-less input yields an empty
	 * safe object.
	 * @throws {@link Exception} with {@link Status.BAD_REQUEST} when the payload is
	 * malformed for its declared type — a `SyntaxError` from decoding is
	 * attributed to the client, and the offending content type is attached to the
	 * exception. Any other error propagates unchanged.
	 */
	async parse(received: Request | Response | Res): Promise<ParsedBody> {
		const isRes = received instanceof Res;
		const source = isRes ? received.toNativeResponse() : received;

		// Read the content-type from the source: Bun derives it lazily for
		// FormData-backed requests, and a clone taken before that derivation
		// does not carry it.
		const contentType = source.headers.get(HeaderKey.ContentType) ?? "";
		const contentTypeDisco = getContentTypeDisco(contentType);

		if (!source.body) return createSafeObject();

		// A Res-derived Response is freshly constructed and unshared, so it
		// needs no clone; anything caller-supplied must stay readable.
		const input = isRes ? source : source.clone();

		try {
			switch (contentTypeDisco) {
				case "json":
					return await this.getJsonBody(input);
				case "form-urlencoded":
					return await this.getFormUrlEncodedBody(input);
				case "form-data":
					return await this.getFormDataBody(input);
				case "text":
				case "xml":
					return await this.getTextBody(input, contentType);
				case "binary":
					return this.getBinaryBody(input);
				default:
					return await this.getUnknownBody(input, contentType);
			}
		} catch (err) {
			if (err instanceof SyntaxError) {
				throw new Exception(err.message, Status.BAD_REQUEST, { contentType });
			}
			throw err;
		}
	}

	/**
	 * Decodes an `application/json` body.
	 *
	 * @param input - The cloned request or response to drain.
	 * @returns The parsed value, or an empty safe object when the body is blank —
	 * an empty payload is treated as "nothing sent" rather than as a syntax error.
	 * @throws `SyntaxError` on malformed JSON, which {@link BodyParser.parse}
	 * converts into a {@link Status.BAD_REQUEST} {@link Exception}.
	 */
	private async getJsonBody(
		input: Request | Response,
	): Promise<Record<string, unknown> | Array<unknown>> {
		const text = await input.text();
		if (!text || text.trim().length === 0) return createSafeObject();
		return JSON.parse(text);
	}

	/**
	 * Decodes an `application/x-www-form-urlencoded` body.
	 *
	 * The pairs are handed to {@link ParsersRegistry.searchParamsParser}, so a
	 * form post and a query string with the same shape produce the same object,
	 * including bracket nesting and repeated keys.
	 *
	 * @param input - The cloned request or response to drain.
	 * @returns The parsed object, or an empty safe object when the body is blank.
	 * Falls back to flat `URLSearchParams` entries if no search params parser is
	 * registered.
	 */
	private async getFormUrlEncodedBody(input: Request | Response): Promise<Record<string, unknown>> {
		const text = await input.text();
		if (!text || text.trim().length === 0) return createSafeObject();
		const searchParams = new URLSearchParams(text);
		const searchParamsParser = getOrInitParsersRegistry().searchParamsParser;
		if (!searchParamsParser) return Object.fromEntries(searchParams.entries());
		return searchParamsParser.parse(searchParams);
	}

	/**
	 * Decodes a `multipart/form-data` body, delegating to
	 * {@link ParsersRegistry.formDataParser} so uploaded files and nested field
	 * names are handled consistently.
	 *
	 * @param input - The cloned request or response to drain.
	 * @returns The parsed object, or flat `FormData` entries if no form data
	 * parser is registered.
	 */
	private async getFormDataBody(input: Request | Response): Promise<Record<string, unknown>> {
		const formData = await input.formData();
		const formDataParser = getOrInitParsersRegistry().formDataParser;
		if (!formDataParser) return Object.fromEntries(formData.entries());
		return formDataParser.parse(formData);
	}

	/**
	 * Decodes a textual body, honouring the `charset` parameter of the content
	 * type.
	 *
	 * `Body.text()` always decodes as UTF-8 per the fetch spec, ignoring the
	 * declared charset, so anything other than UTF-8 is decoded from the raw bytes
	 * with a matching `TextDecoder`. An unrecognised charset label falls back to
	 * UTF-8 rather than failing the request.
	 *
	 * @param input - The cloned request or response to drain.
	 * @param contentType - The full header value, used to extract `charset`.
	 * @returns The decoded text.
	 */
	private async getTextBody(input: Request | Response, contentType: string): Promise<string> {
		const charset =
			contentType
				.match(/charset=([^;]+)/i)?.[1]
				?.trim()
				.toLowerCase() ?? null;

		// Per the fetch spec, Body.text() always decodes as UTF-8,
		// ignoring the Content-Type charset.
		if (!charset || charset === "utf-8" || charset === "utf8") {
			return input.text();
		}

		let decoder: TextDecoder;
		try {
			decoder = new TextDecoder(charset);
		} catch {
			// unknown charset label, fall back to utf-8
			decoder = new TextDecoder("utf-8");
		}
		return decoder.decode(await input.arrayBuffer());
	}

	/**
	 * Passes a binary body through undrained, so large uploads can be streamed
	 * instead of buffered into memory.
	 *
	 * @param input - The cloned request or response.
	 * @returns The body stream, or `null` if there is none.
	 */
	private getBinaryBody(input: Request | Response): ReadableStream<Uint8Array> | null {
		return input.body;
	}

	/**
	 * Handles a body whose content type matched nothing in
	 * {@link CONTENT_TYPE_MAP}, including requests that declared no type at all.
	 *
	 * The body is decoded as text and JSON is attempted opportunistically, so a
	 * client that omits its `Content-Type` still gets structured data. A failed
	 * parse is not an error here — the raw text is returned instead.
	 *
	 * @param input - The cloned request or response to drain.
	 * @param contentType - The full header value, forwarded for charset handling.
	 * @returns The parsed JSON value, the raw text, or an empty safe object when
	 * the body is blank.
	 */
	private async getUnknownBody(
		input: Request | Response,
		contentType: string,
	): Promise<Record<string, unknown> | Array<unknown> | string> {
		const text = await this.getTextBody(input, contentType);
		if (!text || text.trim().length === 0) return createSafeObject();
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
}

export { type BodyParserInterface, BodyParser };

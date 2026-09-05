import { Exception } from "@/Exception";
import { HeaderKey } from "@/Headers";
import { getOrInitParsersRegistry } from "@/ParsersRegistry";
import { Res, Status } from "@/Res";
import type { Nullable } from "@/utils/maybe";
import { createSafeObject } from "@/utils/object";

type ContentTypeDisco = "json" | "form-urlencoded" | "form-data" | "text" | "xml" | "binary";

type ParsedBody =
	| Record<string, unknown>
	| Array<unknown>
	| string
	| ReadableStream<Uint8Array>
	| null;

interface BodyParserInterface {
	parse(received: Request | Response | Res): Promise<ParsedBody>;
}

const CONTENT_TYPE_MAP: Array<[ContentTypeDisco, RegExp]> = [
	["json", /application\/json/],
	["form-urlencoded", /application\/x-www-form-urlencoded/],
	["form-data", /multipart\/form-data/],
	["text", /text\/plain/],
	["xml", /application\/xml|text\/xml/],
	["binary", /application\/octet-stream|application\/pdf|^image\/|^audio\/|^video\//],
];

function getContentTypeDisco(contentType: string): Nullable<ContentTypeDisco> {
	for (const [disco, pattern] of CONTENT_TYPE_MAP) {
		if (pattern.test(contentType)) return disco;
	}
	return null;
}

class BodyParser implements BodyParserInterface {
	/** This can be used for both request and response bodies */
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

	private async getJsonBody(
		input: Request | Response,
	): Promise<Record<string, unknown> | Array<unknown>> {
		const text = await input.text();
		if (!text || text.trim().length === 0) return createSafeObject();
		return JSON.parse(text);
	}

	private async getFormUrlEncodedBody(input: Request | Response): Promise<Record<string, unknown>> {
		const text = await input.text();
		if (!text || text.trim().length === 0) return createSafeObject();
		const searchParams = new URLSearchParams(text);
		const searchParamsParser = getOrInitParsersRegistry().searchParamsParser;
		if (!searchParamsParser) return Object.fromEntries(searchParams.entries());
		return searchParamsParser.parse(searchParams);
	}

	private async getFormDataBody(input: Request | Response): Promise<Record<string, unknown>> {
		const formData = await input.formData();
		const formDataParser = getOrInitParsersRegistry().formDataParser;
		if (!formDataParser) return Object.fromEntries(formData.entries());
		return formDataParser.parse(formData);
	}

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

	private getBinaryBody(input: Request | Response): ReadableStream<Uint8Array> | null {
		return input.body;
	}

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

export type { BodyParserInterface };
export { BodyParser };

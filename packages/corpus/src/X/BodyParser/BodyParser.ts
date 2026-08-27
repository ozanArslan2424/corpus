import { createSafeObject } from "@/utils";

import { Exception } from "@/C/Exception/Exception";
import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import type { Res } from "@/C/Res/Res";
import { Status } from "@/C/Status/Status";
import type { BodyParserInterface, ObjectParserInterface } from "@/Registry/Registry.types";

type NormalizedContentType =
	| "json"
	| "form-urlencoded"
	| "form-data"
	| "text"
	| "xml"
	| "binary"
	| "unknown";

export class BodyParser implements BodyParserInterface {
	constructor(
		private readonly formDataParser: ObjectParserInterface<FormData>,
		private readonly searchParamsParser: ObjectParserInterface<URLSearchParams>,
	) {}

	/** This can be used for both request and response bodies */
	async parse(
		r: Request | Res | Response,
		maxRequestBodySize?: number,
	): Promise<Record<string, unknown> | Array<unknown> | string | ReadableStream<Uint8Array>> {
		let input = this.toWebRequestResponse(r);
		const empty = createSafeObject();

		if (input instanceof Request) {
			input = input.clone();
		}

		const contentType = this.getContentTypeDisco(input);
		const isStreamType = contentType === "binary";

		if (maxRequestBodySize !== undefined && !isStreamType) {
			input = await this.withCappedBody(input, maxRequestBodySize);
		}

		try {
			switch (contentType) {
				case "json":
					return await this.getJsonBody(input);
				case "form-urlencoded":
					return await this.getFormUrlEncodedBody(input);
				case "form-data":
					return await this.getFormDataBody(input);
				case "text":
				case "xml":
					return await this.getTextBody(input);
				case "binary":
					return this.getBinaryBody(input) ?? empty;
				case "unknown":
					return await this.getUnknownBody(input);
				default:
					return empty;
			}
		} catch (err) {
			if (err instanceof SyntaxError) return empty;
			throw err;
		}
	}

	/**
	 * Buffers the body while counting bytes and throws 413 past the limit.
	 * Returns a new Response wrapping the buffered bytes with the original
	 * headers, so the per-type readers (.json(), .text(), .formData()) work unchanged.
	 */
	private async withCappedBody(input: Request | Response, limit: number): Promise<Response> {
		// fast reject when the client declares the size
		const declared = parseInt(input.headers.get(HeaderKey.ContentLength) ?? "");
		if (!isNaN(declared) && declared > limit) {
			throw new Exception("Payload too large", Status.PAYLOAD_TOO_LARGE);
		}

		if (!input.body) return new Response(null, { headers: input.headers });

		// stream-count for chunked/undeclared/lying clients
		const reader = input.body.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > limit) {
				await reader.cancel();
				throw new Exception("Payload too large", Status.PAYLOAD_TOO_LARGE);
			}
			chunks.push(value);
		}
		return new Response(Buffer.concat(chunks), { headers: input.headers });
	}

	private toWebRequestResponse(r: Request | Res | Response): Request | Response {
		return r instanceof Request ? r : r instanceof Response ? r : r.response;
	}

	private getContentTypeDisco(input: Request | Response): NormalizedContentType {
		const contentTypeHeader = input.headers.get(HeaderKey.ContentType) ?? "";

		if (contentTypeHeader.includes("application/json")) {
			return "json";
		} else if (contentTypeHeader.includes("application/x-www-form-urlencoded")) {
			return "form-urlencoded";
		} else if (contentTypeHeader.includes("multipart/form-data")) {
			return "form-data";
		} else if (contentTypeHeader.includes("text/plain")) {
			return "text";
		} else if (contentTypeHeader.includes("application/xml")) {
			return "xml";
		} else if (contentTypeHeader.includes("text/xml")) {
			return "xml";
		} else if (contentTypeHeader.includes("application/octet-stream")) {
			return "binary";
		} else if (contentTypeHeader.includes("application/pdf")) {
			return "binary";
		} else if (contentTypeHeader.includes("image/")) {
			return "binary";
		} else if (contentTypeHeader.includes("audio/")) {
			return "binary";
		} else if (contentTypeHeader.includes("video/")) {
			return "binary";
		}

		return "unknown";
	}

	private getJsonBody(
		input: Request | Response,
	): Promise<Record<string, unknown> | Array<unknown>> {
		return input.json();
	}

	private async getFormUrlEncodedBody(input: Request | Response): Promise<Record<string, unknown>> {
		const text = await input.text();
		if (!text || text.trim().length === 0) {
			throw new SyntaxError("Body is empty");
		}

		const searchParams = new URLSearchParams(text);
		return this.searchParamsParser.parse(searchParams);
	}

	private async getFormDataBody(input: Request | Response): Promise<Record<string, unknown>> {
		const formData = await input.formData();
		return this.formDataParser.parse(formData);
	}

	private async getTextBody(input: Request | Response): Promise<string> {
		const contentTypeHeader = input.headers.get(HeaderKey.ContentType) ?? "";
		const charset =
			contentTypeHeader
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
	): Promise<Record<string, unknown> | Array<unknown> | string> {
		const text = await this.getTextBody(input);
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
}

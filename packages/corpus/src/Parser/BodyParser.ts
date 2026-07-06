import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import { Method } from "@/Method/Method";
import type { BodyParserInterface } from "@/Parser/BodyParserInterface";
import type { ObjectParserInterface } from "@/Parser/ObjectParserInterface";
import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";
import { arrIncludes } from "@/utils/arrays";
import type { UnknownArray } from "@/utils/UnknownArray";
import type { UnknownObject } from "@/utils/UnknownObject";

type NormalizedContentType =
	| "json"
	| "form-urlencoded"
	| "form-data"
	| "text"
	| "xml"
	| "binary"
	| "pdf"
	| "image"
	| "audio"
	| "video"
	| "unknown";

export class BodyParser implements BodyParserInterface {
	constructor(
		private readonly formDataParser: ObjectParserInterface<FormData>,
		private readonly searchParamsParser: ObjectParserInterface<URLSearchParams>,
	) {}

	/** This can be used for both request and response bodies */
	async parse(
		r: Req | Res | Response,
	): Promise<UnknownObject | UnknownArray | string | ReadableStream<Uint8Array>> {
		const input = this.toWebRequestResponse(r);
		const empty = Object.create(null);

		if (this.isMethodWithoutBody(input)) return empty;

		try {
			switch (this.getContentTypeDisco(input)) {
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
				case "pdf":
				case "image":
				case "audio":
				case "video":
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

	private toWebRequestResponse(r: Req | Res | Response): Request | Response {
		return r instanceof Request ? r : r instanceof Response ? r : r.response;
	}

	private getContentTypeDisco(input: Request | Response): NormalizedContentType {
		const contentTypeHeader = input.headers.get(CommonHeaders.ContentType) ?? "";

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
			return "pdf";
		} else if (contentTypeHeader.includes("image/")) {
			return "image";
		} else if (contentTypeHeader.includes("audio/")) {
			return "audio";
		} else if (contentTypeHeader.includes("video/")) {
			return "video";
		}

		return "unknown";
	}

	private isMethodWithoutBody(input: Request | Response): boolean {
		if (!("method" in input) || typeof input.method !== "string") return false;

		return !arrIncludes(input.method.toUpperCase(), [
			Method.POST,
			Method.PUT,
			Method.PATCH,
			Method.DELETE,
		]);
	}

	private getJsonBody(input: Request | Response): Promise<UnknownObject | UnknownArray> {
		return input.json();
	}

	private async getFormUrlEncodedBody(input: Request | Response): Promise<UnknownObject> {
		const text = await input.text();
		if (!text || text.trim().length === 0) {
			throw new SyntaxError("Body is empty");
		}

		const searchParams = new URLSearchParams(text);
		return this.searchParamsParser.parse(searchParams);
	}

	private async getFormDataBody(input: Request | Response): Promise<UnknownObject> {
		const formData = await input.formData();
		return this.formDataParser.parse(formData);
	}

	private async getTextBody(input: Request | Response): Promise<string> {
		const contentLength = input.headers.get(CommonHeaders.ContentLength);
		const length = contentLength ? parseInt(contentLength) : 0;

		// 1MB threshold
		if (length > 0 && length < 1024 * 1024) {
			return input.text();
		}

		const buffer = await input.arrayBuffer();
		const contentType = input.headers.get(CommonHeaders.ContentType) ?? "";
		const match = contentType.match(/charset=([^;]+)/i);
		const charset = match?.[1] ? match[1].trim() : null;

		const decoder = new TextDecoder(charset ?? "utf-8");
		return decoder.decode(buffer);
	}

	private getBinaryBody(input: Request | Response): ReadableStream<Uint8Array> | null {
		return input.body;
	}

	private async getUnknownBody(
		input: Request | Response,
	): Promise<UnknownObject | UnknownArray | string> {
		const text = await this.getTextBody(input);
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
}

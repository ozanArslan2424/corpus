import { Status } from "@/Response/enums/Status";
import { Method } from "@/Request/enums/Method";
import { CommonHeaders } from "@/Headers/enums/CommonHeaders";
import { HttpError } from "@/Error/HttpError";
import type { HttpRequest } from "@/Request/HttpRequest";
import type { HttpResponse } from "@/Response/HttpResponse";
import type { StandardSchemaV1 } from "@/Model/types/StandardSchema";
import type { UnknownObject } from "@/utils/types/UnknownObject";
import type { SchemaValidator } from "@/Model/types/SchemaValidator";
import { arrIncludes } from "@/utils/arrIncludes";
import { isObjectWith } from "@/utils/isObjectWith";
import { objAppendEntry } from "@/utils/objAppendEntry";
import { strIsDefined } from "@/utils/strIsDefined";

export class Parser {
	// TODO: .pipe method doesn't infer correctly because arktype generics are hard
	static async parse<T = UnknownObject>(
		data: unknown,
		validate?: SchemaValidator<T>,
	): Promise<T> {
		if (!validate) return data as T;
		const result = await validate(data);
		if (result.issues !== undefined) {
			const msg = this.issuesToErrorMessage(result.issues);
			throw HttpError.unprocessableEntity(msg);
		}
		return result.value;
	}

	static issuesToErrorMessage(
		issues: readonly StandardSchemaV1.Issue[],
	): string {
		if (issues.length === 0) return "";

		return issues
			.map((issue) => {
				if (!issue.path || issue.path.length === 0) {
					return issue.message;
				}

				const key = issue.path
					.map((segment) =>
						isObjectWith<{ key: string }>(segment, "key")
							? String(segment.key)
							: String(segment as string),
					)
					.join(".");

				return `${key}: ${issue.message}`;
			})
			.join("\n");
	}

	static async getSearch<S = UnknownObject>(
		url: URL,
		validate?: SchemaValidator<S>,
	): Promise<S> {
		const data: UnknownObject = {};

		for (const [key, value] of url.searchParams ?? {}) {
			data[key] = this.processString(value);
		}

		return await this.parse(data, validate);
	}

	static async getBody<B = UnknownObject>(
		r: HttpRequest | HttpResponse | Response,
		validate?: SchemaValidator<B>,
	): Promise<B> {
		let data;
		const empty = {} as B;
		const input =
			r instanceof Request ? r : r instanceof Response ? r : r.response;

		try {
			switch (Parser.getNormalizedContentType(input)) {
				case "json":
					data = await this.getJsonBody(input);
					break;
				case "form-urlencoded":
					data = await this.getFormUrlEncodedBody(input);
					break;
				case "form-data":
					data = await this.getFormDataBody(input);
					break;
				case "text":
					data = await this.getTextBody(input);
					break;
				case "unknown":
					data = await this.getUnknownBody(input);
					break;
				case "xml":
				case "binary":
				case "pdf":
				case "image":
				case "audio":
				case "video":
					throw new HttpError(
						"unprocessable.contentType",
						Status.UNPROCESSABLE_ENTITY,
					);
				case "no-body-allowed":
				default:
					return empty;
			}

			return await this.parse(data, validate);
		} catch (err) {
			if (err instanceof SyntaxError) return empty;
			throw err;
		}
	}

	static async getParams<P = UnknownObject>(
		endpoint: string,
		url: URL,
		validate?: SchemaValidator<P>,
	): Promise<P> {
		const data: UnknownObject = {};

		if (!endpoint.includes(":")) {
			return data as P;
		}

		const defParts = endpoint.split("/");
		const reqParts = url.pathname.split("/");

		for (const [i, defPart] of defParts.entries()) {
			const reqPart = reqParts[i];

			if (defPart.startsWith(":") && reqPart !== undefined) {
				const key = defPart.slice(1);
				const value = this.processString(decodeURIComponent(reqPart));
				data[key] = value;
			}
		}

		return await this.parse(data, validate);
	}

	private static async getUnknownBody<B = UnknownObject>(
		input: Request | Response,
		validate?: SchemaValidator<B>,
	): Promise<unknown> {
		if (!validate) {
			return await this.getTextBody(input);
		}
		try {
			return await this.getJsonBody(input);
		} catch {
			return await this.getTextBody(input);
		}
	}

	private static async getJsonBody(req: Request | Response): Promise<unknown> {
		return await req.json();
	}

	private static async getFormUrlEncodedBody(
		input: Request | Response,
	): Promise<unknown> {
		const text = await input.text();
		if (!text || text.trim().length === 0) {
			throw new SyntaxError("Body is empty");
		}

		const params = new URLSearchParams(text);
		const body: Record<string, any> = {};

		for (const [key, value] of params.entries()) {
			objAppendEntry(body, key, this.processString(value));
		}

		return body;
	}

	private static async getFormDataBody(
		input: Request | Response,
	): Promise<unknown> {
		const formData = await input.formData();
		const entries = formData.entries() as IterableIterator<
			[string, FormDataEntryValue]
		>;

		const body: UnknownObject = {};

		for (const [key, value] of entries) {
			if (value instanceof File) {
				body[key] = value;
			} else {
				objAppendEntry(body, key, this.processString(value));
			}
		}

		return body;
	}

	private static async getTextBody(
		input: Request | Response,
	): Promise<unknown> {
		const contentLength = input.headers.get(CommonHeaders.ContentLength);
		const length = contentLength ? parseInt(contentLength) : 0;

		// 1MB threshold
		if (length > 0 && length < 1024 * 1024) {
			const text = await input.text();
			return this.processString(text);
		}

		const buffer = await input.arrayBuffer();
		const contentType = input.headers.get(CommonHeaders.ContentType) || "";
		const match = contentType.match(/charset=([^;]+)/i);
		const charset = match?.[1] ? match[1].trim() : null;

		const decoder = new TextDecoder(charset || "utf-8");
		const text = decoder.decode(buffer);

		return this.processString(text);
	}

	static getNormalizedContentType(input: Request | Response): string {
		const contentTypeHeader =
			input.headers.get(CommonHeaders.ContentType) || "";

		if (
			"method" in input &&
			typeof input.method === "string" &&
			!arrIncludes(input.method.toUpperCase(), [
				Method.POST,
				Method.PUT,
				Method.PATCH,
				Method.DELETE,
			])
		) {
			return "no-body-allowed";
		}

		if (contentTypeHeader.includes("application/json")) {
			return "json";
		} else if (
			contentTypeHeader.includes("application/x-www-form-urlencoded")
		) {
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

	static processString(value: string): string | boolean | number {
		let processedValue: string | boolean | number = value;
		if (!strIsDefined(value)) return "";

		if (/^-?\d+(\.\d+)?$/.test(value)) {
			processedValue = Number(value);
		} else if (
			value.toLowerCase() === "true" ||
			value.toLowerCase() === "false"
		) {
			processedValue = value.toLowerCase() === "true";
		}

		return processedValue;
	}
}

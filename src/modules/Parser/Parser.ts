import { Status } from "@/modules/HttpResponse/enums/Status";
import type { HttpRequestInterface } from "@/modules/HttpRequest/HttpRequestInterface";
import { HttpError } from "@/modules/HttpError/HttpError";
import { appendEntry } from "@/utils/appendEntry";
import { getProcessedValue } from "@/utils/getProcessedValue";
import type { HttpResponseInterface } from "@/modules/HttpResponse/HttpResponseInterface";
import { CommonHeaders } from "@/modules/HttpHeaders/enums/CommonHeaders";
import { Method } from "@/modules/HttpRequest/enums/Method";
import { isFoundIn } from "@/utils/isFoundIn";
import type { Schema } from "@/modules/Parser/types/Schema";
import type { StandardSchemaV1 } from "@/modules/Parser/types/StandardSchema";
import { isObjectWith } from "@/utils/isObjectWith";
import type { UnknownObject } from "@/utils/UnknownObject";

type ReqRes = Request | Response;

export class Parser {
	static async parse<T = UnknownObject>(
		data: unknown,
		schema?: Schema<T>,
	): Promise<T> {
		if (!schema) return data as T;
		const std = schema["~standard"] as StandardSchemaV1.Props<unknown, T>;
		const result = await std.validate(data);
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
							: String(segment),
					)
					.join(".");

				return `${key}: ${issue.message}`;
			})
			.join("\n");
	}

	// TODO: .pipe method doesn't work because arktype generics are hard
	static getParserVendor(schema: Schema) {
		return schema["~standard"].vendor;
	}

	static async getSearch<S = UnknownObject>(
		url: URL,
		schema?: Schema<S>,
	): Promise<S> {
		const data: UnknownObject = {};

		if (url.searchParams.size === 0) {
			return data as S;
		}

		for (const [key, value] of url.searchParams) {
			data[key] = getProcessedValue(value);
		}

		return await this.parse(data, schema);
	}

	static async getBody<B = UnknownObject>(
		r: HttpRequestInterface | HttpResponseInterface | Response,
		schema?: Schema<B>,
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
				case "xml":
				case "binary":
				case "pdf":
				case "image":
				case "audio":
				case "video":
				case "unknown":
					throw new HttpError(
						"unprocessable.contentType",
						Status.UNPROCESSABLE_ENTITY,
					);
				case "no-body-allowed":
				default:
					return empty;
			}

			return await this.parse(data, schema);
		} catch (err) {
			if (err instanceof SyntaxError) return empty;
			throw err;
		}
	}

	static async getParams<P = UnknownObject>(
		path: string,
		url: URL,
		schema?: Schema<P>,
	): Promise<P> {
		const data: UnknownObject = {};

		if (!path.includes(":")) {
			return data as P;
		}

		const defParts = path.split("/");
		const reqParts = url.pathname.split("/");

		for (const [i, defPart] of defParts.entries()) {
			const reqPart = reqParts[i];

			if (defPart.startsWith(":") && reqPart !== undefined) {
				const key = defPart.slice(1);
				const value = getProcessedValue(decodeURIComponent(reqPart));
				data[key] = value;
			}
		}

		return await this.parse(data, schema);
	}

	private static async getJsonBody(req: ReqRes): Promise<unknown> {
		return await req.json();
	}

	private static async getFormUrlEncodedBody(req: ReqRes): Promise<unknown> {
		const text = await req.text();
		if (!text || text.trim().length === 0) {
			throw new SyntaxError("Body is empty");
		}

		const params = new URLSearchParams(text);
		const body: Record<string, any> = {};

		for (const [key, value] of params.entries()) {
			appendEntry(body, key, value);
		}

		return body;
	}

	private static async getFormDataBody(req: ReqRes): Promise<unknown> {
		const formData = await req.formData();
		const entries = formData.entries() as IterableIterator<
			[string, FormDataEntryValue]
		>;

		const body: UnknownObject = {};

		for (const [key, value] of entries) {
			if (value instanceof File) {
				body[key] = value;
			} else {
				appendEntry(body, key, value);
			}
		}

		return body;
	}

	private static async getTextBody(req: ReqRes): Promise<unknown> {
		const contentLength = req.headers.get("content-length");
		const length = contentLength ? parseInt(contentLength) : 0;

		// 1MB threshold
		if (length > 0 && length < 1024 * 1024) {
			const text = await req.text();
			return getProcessedValue(text);
		}

		const buffer = await req.arrayBuffer();
		const contentType = req.headers.get("content-type") || "";
		const match = contentType.match(/charset=([^;]+)/i);
		const charset = match?.[1] ? match[1].trim() : null;

		const decoder = new TextDecoder(charset || "utf-8");
		const text = decoder.decode(buffer);

		return getProcessedValue(text);
	}

	static getNormalizedContentType(input: ReqRes): string {
		const contentTypeHeader =
			input.headers.get(CommonHeaders.ContentType) || "";

		if (
			"method" in input &&
			typeof input.method === "string" &&
			!isFoundIn(input.method.toUpperCase(), [
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
}

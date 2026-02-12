import { Status } from "@/internal/enums/Status";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import { CoreumError } from "@/internal/modules/CoreumError/CoreumError";
import type { SchemaType } from "@/internal/types/SchemaType";
import { appendEntry } from "@/internal/utils/appendEntry";
import { getProcessedValue } from "@/internal/utils/getProcessedValue";
import { Parser } from "@/internal/modules/Parser/Parser";

export class RequestParser {
	private readonly parser = new Parser();

	async getJsonBody(req: CoreumRequestInterface): Promise<unknown> {
		return await req.json();
	}

	async getFormUrlEncodedBody(req: CoreumRequestInterface): Promise<unknown> {
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

	async getFormDataBody(req: CoreumRequestInterface): Promise<unknown> {
		const formData = await req.formData();
		const entries = formData.entries() as IterableIterator<
			[string, FormDataEntryValue]
		>;

		const body: Record<string, unknown> = {};

		for (const [key, value] of entries) {
			if (value instanceof File) {
				body[key] = value;
			} else {
				appendEntry(body, key, value);
			}
		}

		return body;
	}

	async getTextBody(req: CoreumRequestInterface): Promise<unknown> {
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

	async getBody<ReqBody = unknown>(
		req: CoreumRequestInterface,
		schema?: SchemaType<ReqBody>,
	): Promise<ReqBody> {
		let data;
		const empty = {} as ReqBody;

		try {
			switch (req.normalizedContentType) {
				case "json":
					data = await this.getJsonBody(req);
					break;
				case "form-urlencoded":
					data = await this.getFormUrlEncodedBody(req);
					break;
				case "form-data":
					data = await this.getFormDataBody(req);
					break;
				case "text":
					data = await this.getTextBody(req);
					break;
				case "xml":
				case "binary":
				case "pdf":
				case "image":
				case "audio":
				case "video":
				case "unknown":
					throw new CoreumError(
						"unprocessable.contentType",
						Status.UNPROCESSABLE_ENTITY,
					);
				case "no-body-allowed":
				default:
					return empty;
			}

			if (schema) {
				return this.parser.parse(data, schema, "unprocessable.body") as ReqBody;
			}

			return data as ReqBody;
		} catch (err) {
			if (err instanceof SyntaxError) return empty;
			throw err;
		}
	}

	getParams<ReqParams = unknown>(
		path: string,
		url: URL,
		schema?: SchemaType<ReqParams>,
	): ReqParams {
		const data: Record<string, unknown> = {};

		if (!path.includes(":")) {
			return data as ReqParams;
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

		if (schema) {
			return this.parser.parse(
				data,
				schema,
				"unprocessable.search",
			) as ReqParams;
		}

		return data as ReqParams;
	}

	getSearch<ReqSearch = unknown>(
		url: URL,
		schema?: SchemaType<ReqSearch>,
	): ReqSearch {
		const data: Record<string, unknown> = {};

		for (const [key, value] of url.searchParams.entries()) {
			const processedValue = getProcessedValue(value);
			appendEntry(data, key, processedValue);
		}

		if (schema) {
			return this.parser.parse(
				data,
				schema,
				"unprocessable.search",
			) as ReqSearch;
		}

		return data as ReqSearch;
	}
}

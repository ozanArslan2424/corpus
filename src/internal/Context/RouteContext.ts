import { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";
import { Status } from "@/internal/Status/Status";
import type { RouteSchemas } from "@/internal/Route/RouteSchemas";
import { CoreumError } from "@/internal/CoreumError/CoreumError";
import { parse } from "@/internal/Parser/parse";
import type { RouteContextInterface } from "@/internal/Context/RouteContextInterface";

export class RouteContext<
	D = void,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> implements RouteContextInterface<D, B, S, P> {
	constructor(
		private readonly request: Request,
		readonly path: string,
		private readonly schemas?: RouteSchemas<R, B, S, P>,
		public data?: D,
	) {
		this.req = new CoreumRequest(this.request);
		this.url = new URL(this.req.url);
		this.headers = new CoreumHeaders(this.req.headers);
		this.cookies = new CoreumCookies();
	}

	req: CoreumRequest;
	url: URL;
	headers: CoreumHeaders;
	cookies: CoreumCookies;
	status: Status = Status.OK;
	statusText: string = "OK";

	async body(): Promise<B> {
		let data;
		const empty = {} as B;

		try {
			switch (this.req.contentType) {
				case "json":
					data = await this.getJsonBody(this.req);
					break;
				case "form-urlencoded":
					data = await this.getFormUrlEncodedBody(this.req);
					break;
				case "form-data":
					data = await this.getFormDataBody(this.req);
					break;
				case "text":
					data = await this.getTextBody(this.req);
					break;
				case "xml":
				case "binary":
				case "pdf":
				case "image":
				case "audio":
				case "video":
					throw new CoreumError(
						"unprocessable.contentType",
						Status.UNPROCESSABLE_ENTITY,
					);
				case "unknown":
					throw new CoreumError(
						"unprocessable.body",
						Status.UNPROCESSABLE_ENTITY,
					);
				case "no-body-allowed":
				default:
					return empty;
			}

			return this.parseWithSchema("body", data);
		} catch (err) {
			if (err instanceof SyntaxError) return empty;
			throw err;
		}
	}

	get search(): S {
		const data: Record<string, unknown> = {};

		for (const [key, value] of this.url.searchParams.entries()) {
			const processedValue = this.getProcessedValue(value);
			this.appendEntry(data, key, processedValue);
		}

		return this.parseWithSchema<S>("search", data);
	}

	get params(): P {
		const definedPathSegments = this.path.split("/");
		const requestPathSegments = this.url.pathname.split("/");

		const paramsObject: Record<string, unknown> = {};

		for (const [index, definedPathSegment] of definedPathSegments.entries()) {
			const requestPathSegment = requestPathSegments[index];

			if (
				definedPathSegment.startsWith(":") &&
				requestPathSegment !== undefined
			) {
				const paramName = definedPathSegment.slice(1);
				const paramValue = requestPathSegment;
				paramsObject[paramName] = this.getProcessedValue(paramValue);
			}
		}

		return this.parseWithSchema("params", paramsObject);
	}

	private appendEntry(
		data: Record<string, unknown>,
		key: string,
		value: string | boolean | number,
	) {
		const existing = data[key];
		if (existing !== undefined) {
			data[key] = Array.isArray(existing)
				? [...existing, value]
				: [existing, value];
		} else {
			data[key] = value;
		}
	}

	private getProcessedValue(value: string) {
		let processedValue: string | boolean | number = value;

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

	private parseWithSchema<O>(
		type: "body" | "params" | "search",
		data: unknown,
	): O {
		const schema = this.schemas?.[type] as any | undefined;
		if (schema) {
			return parse(data, schema, `unprocessable.${type}`) as O;
		}
		return data as O;
	}

	private async getJsonBody(req: CoreumRequest): Promise<unknown> {
		return await req.json();
	}

	private async getFormUrlEncodedBody(req: CoreumRequest): Promise<unknown> {
		const text = await req.text();
		if (!text || text.trim().length === 0) {
			throw new SyntaxError("Body is empty");
		}

		const params = new URLSearchParams(text);
		const body: Record<string, any> = {};

		for (const [key, value] of params.entries()) {
			this.appendEntry(body, key, value);
		}

		return body;
	}

	private async getFormDataBody(req: CoreumRequest): Promise<unknown> {
		const formData = await req.formData();
		const entries = formData.entries() as IterableIterator<
			[string, FormDataEntryValue]
		>;

		const body: Record<string, unknown> = {};

		for (const [key, value] of entries) {
			if (value instanceof File) {
				body[key] = value;
			} else {
				this.appendEntry(body, key, value);
			}
		}

		return body;
	}

	private async getTextBody(req: CoreumRequest): Promise<unknown> {
		const contentLength = req.headers.get("content-length");
		const length = contentLength ? parseInt(contentLength) : 0;

		// 1MB threshold
		if (length > 0 && length < 1024 * 1024) {
			const text = await req.text();
			return text;
		}

		const buffer = await req.arrayBuffer();
		const contentType = req.headers.get("content-type") || "";
		const match = contentType.match(/charset=([^;]+)/i);
		const charset = match?.[1] ? match[1].trim() : null;

		const decoder = new TextDecoder(charset || "utf-8");
		const text = decoder.decode(buffer);

		return text;
	}
}

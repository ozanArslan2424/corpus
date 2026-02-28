import { DefaultStatusTexts } from "@/Response/enums/DefaultStatusTexts";
import { Status } from "@/Response/enums/Status";
import { CommonHeaders } from "@/Headers/enums/CommonHeaders";
import { Cookies } from "@/Cookies/Cookies";
import { HttpHeaders } from "@/Headers/HttpHeaders";
import type { HttpResponseBody } from "@/Response/types/HttpResponseBody";
import type { HttpResponseInit } from "@/Response/types/HttpResponseInit";

/**
 * This is NOT the default response. It provides {@link HttpResponse.response}
 * getter to access web Response with all mutations applied during the
 * handling of the request, JSON body will be handled and cookies will be
 * applied to response headers.
 * */

export class HttpResponse<R = unknown> {
	constructor(
		readonly body?: HttpResponseBody<R>,
		readonly init?: HttpResponseInit,
	) {
		this.cookies = this.getCookies();
		this.headers = this.getHeaders();
		this.body = this.getBody();
		this.status = this.getStatus();
		this.statusText = this.getDefaultStatusText();
	}

	headers: HttpHeaders;
	status: Status;
	statusText: string;
	cookies: Cookies;

	get response(): Response {
		return new Response(this.body as BodyInit, {
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
		});
	}

	private getCookies(): Cookies {
		return new Cookies(this.init?.cookies);
	}

	private getHeaders(): HttpHeaders {
		const headers = new HttpHeaders(this.init?.headers);

		const setCookieHeaders = this.cookies.toSetCookieHeaders();

		if (setCookieHeaders.length > 0) {
			for (const header of setCookieHeaders) {
				headers.append(CommonHeaders.SetCookie, header);
			}
		}

		return headers;
	}

	private getStatus() {
		if (this.init?.status) return this.init.status;
		if (this.headers.has(CommonHeaders.Location)) {
			return Status.FOUND;
		}
		return Status.OK;
	}

	private setContentType(value: string) {
		if (
			!this.headers.has(CommonHeaders.ContentType) ||
			this.headers.get(CommonHeaders.ContentType) === "text/plain"
		) {
			this.headers.set(CommonHeaders.ContentType, value);
		}
	}

	private getBody() {
		// Handle null/undefined
		if (this.body === null || this.body === undefined) {
			this.setContentType("text/plain");
			return "";
		}

		// Handle primitives (string, number, boolean, bigint)
		if (typeof this.body !== "object") {
			this.setContentType("text/plain");
			return String(this.body);
		}

		// TODO: Handle special types that shouldn't be serialized
		if (
			this.body instanceof ArrayBuffer ||
			this.body instanceof Blob ||
			this.body instanceof FormData ||
			this.body instanceof URLSearchParams ||
			this.body instanceof ReadableStream
		) {
			throw new Error(
				"Unsupported response body: ArrayBuffer | Blob | FormData | URLSearchParams | ReadableStream",
			);
		}

		// Handle Date objects
		if (this.body instanceof Date) {
			this.setContentType("text/plain");
			return this.body.toISOString();
		}

		// Handle arrays and plain objects (JSON serializable)
		if (Array.isArray(this.body) || this.body.constructor === Object) {
			this.setContentType("application/json");
			return JSON.stringify(this.body);
		}

		// Handle other objects (custom classes, etc.)
		this.setContentType("text/plain");
		// TODO: ???
		// oxlint-disable-next-line typescript/no-base-to-string
		return String(this.body);
	}

	private getDefaultStatusText(): string {
		const key = this.status as keyof typeof DefaultStatusTexts;
		return DefaultStatusTexts[key] ?? "Unknown";
	}

	static redirect(url: string | URL, init?: HttpResponseInit): HttpResponse {
		const res = new HttpResponse(undefined, {
			...init,
			status: init?.status ?? Status.FOUND,
			statusText: init?.statusText ?? DefaultStatusTexts[Status.FOUND],
		});
		const urlString = url instanceof URL ? url.toString() : url;
		res.headers.set(CommonHeaders.Location, urlString);
		return res;
	}

	static permanentRedirect(
		url: string | URL,
		init?: Omit<HttpResponseInit, "status">,
	): HttpResponse {
		return this.redirect(url, {
			...init,
			status: Status.MOVED_PERMANENTLY,
		});
	}

	static temporaryRedirect(
		url: string | URL,
		init?: Omit<HttpResponseInit, "status">,
	): HttpResponse {
		return this.redirect(url, { ...init, status: Status.TEMPORARY_REDIRECT });
	}

	static seeOther(
		url: string | URL,
		init?: Omit<HttpResponseInit, "status">,
	): HttpResponse {
		return this.redirect(url, { ...init, status: Status.SEE_OTHER });
	}
}

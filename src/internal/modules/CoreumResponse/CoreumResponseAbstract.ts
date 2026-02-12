import { CommonHeaders } from "@/internal/enums/CommonHeaders";
import { Status } from "@/internal/enums/Status";
import { DefaultStatusTexts } from "@/internal/enums/DefaultStatusTexts";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";
import { CoreumHeaders } from "@/internal/modules/CoreumHeaders/CoreumHeaders";
import type { CoreumResponseBody } from "@/internal/types/CoreumResponseBody";
import type { CoreumResponseInit } from "@/internal/types/CoreumResponseInit";
import { Cookies } from "@/internal/modules/Cookies/Cookies";
import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";
import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";

export abstract class CoreumResponseAbstract<
	R = unknown,
> implements CoreumResponseInterface<R> {
	constructor(
		readonly body?: CoreumResponseBody<R>,
		readonly init?: CoreumResponseInit,
	) {
		this.cookies = this.getCookies();
		this.headers = this.getHeaders();
		this.body = this.getBody();
		this.status = this.getStatus();
		this.statusText = this.getDefaultStatusText();
	}

	headers: CoreumHeadersInterface;
	status: Status;
	statusText: string;
	cookies: CookiesInterface;

	get response(): Response {
		return new Response(this.body as BodyInit, {
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
		});
	}

	private getCookies(): CookiesInterface {
		return new Cookies(this.init?.cookies);
	}

	private getHeaders(): CoreumHeadersInterface {
		const headers = new CoreumHeaders(this.init?.headers);

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
		this.headers.set(CommonHeaders.ContentType, value);
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
		return String(this.body);
	}

	private getDefaultStatusText(): string {
		const key = this.status as keyof typeof DefaultStatusTexts;
		return DefaultStatusTexts[key] ?? "Unknown";
	}
}

import { CommonHeaders } from "@/internal/CommonHeaders/CommonHeaders";
import { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { CoreumResponseBody } from "@/internal/CoreumResponse/CoreumResponseBody";
import type { CoreumResponseInit } from "@/internal/CoreumResponse/CoreumResponseInit";
import { Status } from "@/internal/Status/Status";
import { isFoundIn } from "@/utils/isFoundIn";
import { isJSONSerializable } from "@/utils/isJSONSerializable";

export class CoreumResponse<R = unknown> {
	headers: CoreumHeaders;
	status: Status;
	statusText: string;

	constructor(
		private body?: CoreumResponseBody<R>,
		private readonly init?: CoreumResponseInit,
	) {
		this.headers = new CoreumHeaders(this.init?.headers);
		this.appendCookieHeaders();
		this.appendBody();
		this.status = this.getStatus();
		this.statusText = this.getDefaultStatusText();
	}

	private isRedirectStatus(status: Status): boolean {
		return isFoundIn(status, [
			Status.MOVED_PERMANENTLY, // 301
			Status.FOUND, // 302
			Status.SEE_OTHER, // 303
			Status.TEMPORARY_REDIRECT, // 307
			Status.PERMANENT_REDIRECT, // 308
		]);
	}

	private getStatus() {
		if (this.init?.status) return this.init.status;
		if (this.headers.has(CommonHeaders.Location)) {
			return Status.FOUND;
		}
		return Status.OK;
	}

	private appendCookieHeaders() {
		const setCookieHeaders = this.init?.cookies?.toSetCookieHeaders();

		if (setCookieHeaders && setCookieHeaders.length > 0) {
			for (const header of setCookieHeaders) {
				this.headers.append(CommonHeaders.SetCookie, header);
			}
		}
	}

	private appendBody() {
		if (!isJSONSerializable(this.body)) return;
		this.body = JSON.stringify(this.body);
		if (this.headers.has(CommonHeaders.ContentType)) return;
		this.headers.set(CommonHeaders.ContentType, "application/json");
	}

	private getDefaultStatusText(): string {
		const statusTexts: Partial<Record<Status, string>> = {
			[Status.OK]: "OK",
			[Status.CREATED]: "Created",
			[Status.NO_CONTENT]: "No Content",
			[Status.MOVED_PERMANENTLY]: "Moved Permanently",
			[Status.FOUND]: "Found",
			[Status.SEE_OTHER]: "See Other",
			[Status.TEMPORARY_REDIRECT]: "Temporary Redirect",
			[Status.PERMANENT_REDIRECT]: "Permanent Redirect",
			[Status.BAD_REQUEST]: "Bad Request",
			[Status.UNAUTHORIZED]: "Unauthorized",
			[Status.FORBIDDEN]: "Forbidden",
			[Status.NOT_FOUND]: "Not Found",
			[Status.INTERNAL_SERVER_ERROR]: "Internal Server Error",
		};
		return statusTexts[this.status] ?? "Unknown";
	}

	static redirect(
		url: string | URL,
		init?: CoreumResponseInit,
	): CoreumResponse {
		const res = new CoreumResponse(undefined, {
			...init,
			status: init?.status ?? Status.FOUND,
			statusText: init?.statusText ?? "Found",
		});
		const urlString = url instanceof URL ? url.toString() : url;
		res.headers.set(CommonHeaders.Location, urlString);

		return res;
	}

	static permanentRedirect(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponse {
		return this.redirect(url, {
			...init,
			status: Status.MOVED_PERMANENTLY,
		});
	}

	static temporaryRedirect(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponse {
		return this.redirect(url, {
			...init,
			status: Status.TEMPORARY_REDIRECT,
		});
	}

	static seeOther(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponse {
		return this.redirect(url, {
			...init,
			status: Status.SEE_OTHER,
		});
	}

	get response(): Response {
		return new Response(this.body as BodyInit | null, {
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
		});
	}

	get redirectLocation(): string | null {
		return this.headers.get(CommonHeaders.Location);
	}

	get isRedirect(): boolean {
		return this.isRedirectStatus(this.status);
	}
}

import { Method } from "@/Request/enums/Method";
import { CommonHeaders } from "@/Headers/enums/CommonHeaders";
import { Cookies } from "@/Cookies/Cookies";
import { HttpHeaders } from "@/Headers/HttpHeaders";
import type { HttpRequestInfo } from "@/Request/types/HttpRequestInfo";
import type { HttpRequestInit } from "@/Request/types/HttpRequestInit";
import { strSplit } from "@/utils/strSplit";

/** HttpRequest includes a cookie jar, better headers, and some utilities. */

export class HttpRequest extends Request {
	constructor(
		readonly info: HttpRequestInfo,
		readonly init?: HttpRequestInit,
	) {
		super(info, init);
		this.urlObject = this.resolveUrlObject();
		this.headers = this.resolveHeaders();
		this.cookies = this.resolveCookies();
		this.isPreflight = this.resolveIsPreflight();
	}

	readonly urlObject: URL;
	readonly isPreflight: boolean;
	readonly cookies: Cookies;
	override headers: HttpHeaders;

	private resolveUrlObject(): URL {
		let urlObject: URL;

		switch (true) {
			case this.info instanceof URL:
				urlObject = this.info;
				break;

			case this.info instanceof HttpRequest:
				urlObject = this.info.urlObject;
				break;

			case this.info instanceof Request:
				urlObject = new URL(this.info.url);
				break;

			default: // string
				urlObject = new URL(this.info);
				break;
		}

		if (!urlObject.pathname) {
			urlObject.pathname += "/";
		}

		return urlObject;
	}

	private resolveHeaders(): HttpHeaders {
		if (this.init?.headers !== undefined) {
			return new HttpHeaders(this.init.headers);
		}
		if (this.info instanceof Request || this.info instanceof HttpRequest) {
			return new HttpHeaders(this.info.headers);
		}
		return new HttpHeaders();
	}

	/** Gets cookie header and collects cookies for the jar */
	private resolveCookies(): Cookies {
		const jar = new Cookies();

		const cookieHeader = this.headers.get(CommonHeaders.Cookie);

		if (cookieHeader) {
			const pairs = strSplit(";", cookieHeader);

			for (const pair of pairs) {
				const [name, value] = strSplit("=", pair);
				if (!name || !value) continue;
				jar.set({ name, value });
			}
		}

		return jar;
	}

	private resolveIsPreflight() {
		const accessControlRequestMethodHeader = this.headers.has(
			CommonHeaders.AccessControlRequestMethod,
		);
		return this.method === Method.OPTIONS && accessControlRequestMethodHeader;
	}
}

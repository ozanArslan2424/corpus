import { strSplit } from "@/utils/strings";

import { CHeaders } from "@/CHeaders/CHeaders";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import { Cookies } from "@/Cookies/Cookies";
import type { CookiesInterface } from "@/Cookies/CookiesInterface";
import { Method } from "@/Method/Method";
import type { ReqInfo } from "@/Req/ReqInfo";
import type { ReqInit } from "@/Req/ReqInit";

/** Req includes a cookie jar, better headers, and some utilities. */

export class Req extends Request {
	constructor(
		readonly info: ReqInfo,
		readonly init?: ReqInit,
	) {
		super(info, init);
		this.headers = new CHeaders(super.headers);
		this.urlObject = new URL(super.url);
		if (!this.urlObject.pathname) this.urlObject.pathname += "/";
		this.cookies = this.resolveCookies();
	}

	override readonly headers: CHeaders;
	readonly urlObject: URL;
	readonly cookies: CookiesInterface;

	get isPreflight(): boolean {
		return (
			this.method === Method.OPTIONS && this.headers.has(CommonHeaders.AccessControlRequestMethod)
		);
	}

	get isWebsocket(): boolean {
		const isUpgrade = this.headers.get(CommonHeaders.Connection)?.toLowerCase() === "upgrade";
		const isWebsocket = this.headers.get(CommonHeaders.Upgrade)?.toLowerCase() === "websocket";
		return isUpgrade && isWebsocket;
	}

	private resolveCookies(): CookiesInterface {
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
}

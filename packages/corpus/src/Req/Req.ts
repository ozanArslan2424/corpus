import { Cookies } from "@/Cookies/Cookies";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import type { ReqInfo, ReqInit } from "@/Req/types";
import { strSplit } from "@/utils/strings";

/** Req includes a cookie jar, better headers, and some utilities. */

export class Req extends Request {
	constructor(
		readonly info: ReqInfo,
		readonly init?: ReqInit,
	) {
		super(info, init);
		this.headers = new Headers(super.headers);
		this.urlObject = new URL(super.url);
		if (!this.urlObject.pathname) this.urlObject.pathname += "/";
		this.cookies = this.resolveCookies();
	}

	override readonly headers: Headers;
	readonly urlObject: URL;
	readonly cookies: Cookies;

	get isPreflight(): boolean {
		return this.method === Method.OPTIONS && this.headers.has(HeaderKey.AccessControlRequestMethod);
	}

	get isWebsocket(): boolean {
		const isUpgrade = this.headers.get(HeaderKey.Connection)?.toLowerCase() === "upgrade";
		const isWebsocket = this.headers.get(HeaderKey.Upgrade)?.toLowerCase() === "websocket";
		return isUpgrade && isWebsocket;
	}

	private resolveCookies(): Cookies {
		const jar = new Cookies();

		const cookieHeader = this.headers.get(HeaderKey.Cookie);

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

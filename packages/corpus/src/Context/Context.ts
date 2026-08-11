import { HeaderKey } from "@/enums/HeaderKey";
import { Res } from "@/Res/Res";
import type { ServerApp } from "@/Server/types";
import type { ContextDataInterface } from "@/types";
import { createSafeObject } from "@/utils/objects";
import { strSplit } from "@/utils/strings";
import type { nil } from "@/utils/types";

/**
 * The context object used in Route "callback" parameter.
 * Takes 4 optional generics:
 * B = Request body
 * S = Request URL search params
 * P = Request URL params
 * R = The return type
 *
 * Contains:
 * req = Req instance (readonly)
 * res = Res instance
 * url = Request URL object
 * headers = Request Headers
 * cookies = Request Cookies
 * body = Parsed Request body
 * search = Parsed Request URL search params
 * params = Parsed Request URL params
 * data = Data object shared with middlewares
 * */

type RawBody =
	| Record<string, unknown>
	| Array<unknown>
	| string
	| ReadableStream<Uint8Array>
	| undefined;

export class Context<B = unknown, S = unknown, P = unknown, R = unknown> {
	constructor(
		public readonly req: Request,
		public readonly server: ServerApp | nil,
	) {}

	rawBody: RawBody;
	body = createSafeObject<B>();
	params = createSafeObject<P>();
	search = createSafeObject<S>();
	data: ContextDataInterface = createSafeObject();

	private _res: Res<R> | null = null;
	get res(): Res<R> {
		if (!this._res) this._res = new Res();
		return this._res;
	}
	set res(res: Res<R>) {
		this._res = res;
	}

	private _url: URL | null = null;
	get url(): URL {
		if (!this._url) this._url = new URL(this.req.url);
		return this._url;
	}

	get headers(): Headers {
		return this.req.headers;
	}

	private _cookies: Bun.CookieMap | null = null;
	public get cookies(): Bun.CookieMap {
		if (this._cookies) return this._cookies;
		// req may be Bun.BunRequest
		if ("cookies" in this.req && this.req.cookies instanceof Bun.CookieMap) {
			this._cookies = this.req.cookies;
			return this._cookies;
		}

		this._cookies = new Bun.CookieMap();

		const cookieHeader = this.req.headers.get(HeaderKey.Cookie);

		if (cookieHeader) {
			const pairs = strSplit(";", cookieHeader);

			for (const pair of pairs) {
				const eq = pair.indexOf("=");
				if (eq <= 0) continue;
				const name = pair.slice(0, eq).trim();
				const value = pair.slice(eq + 1).trim();
				if (!name || !value) continue;
				this._cookies.set({ name, value });
			}
		}

		return this._cookies;
	}
}

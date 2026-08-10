import { Cookies } from "@/Cookies/Cookies";
import { HeaderKey } from "@/enums/HeaderKey";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import type { ServerApp } from "@/Server/types";
import type { ContextDataInterface, RouteModel } from "@/types";
import { isEmpty } from "@/utils/is";
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

	model: RouteModel<B, S, P, R> | undefined;
	rawBody: RawBody;
	rawParams: Record<string, string> | undefined;
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

	private _cookies: Cookies | null = null;
	public get cookies(): Cookies {
		if (this._cookies) return this._cookies;

		this._cookies = new Cookies();

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

	private _body: B | undefined;
	public get body(): B {
		if (!this._body) {
			if (this.rawBody) {
				this._body = $registry.schemaParser.parse("body", this.rawBody, this.model?.body);
			} else {
				this._body = createSafeObject<B>();
			}
		}
		return this._body;
	}
	public set body(value: B) {
		this._body = value;
	}

	private _search: S | undefined;
	public get search(): S {
		if (!this._search) {
			const qIndex = this.req.url.indexOf("?");
			if (qIndex !== -1) {
				this._search = $registry.schemaParser.parse(
					"search",
					$registry.searchParamsParser.parse(new URLSearchParams(this.req.url.slice(qIndex + 1))),
					this.model?.search,
				);
			} else {
				this._search = createSafeObject<S>();
			}
		}
		return this._search;
	}
	public set search(value: S) {
		this._search = value;
	}

	private _params: P | undefined;
	public get params(): P {
		if (!this._params) {
			if (!isEmpty(this.rawParams)) {
				this._params = $registry.schemaParser.parse(
					"params",
					$registry.urlParamsParser.parse(this.rawParams),
					this.model?.params,
				);
			} else {
				this._params = createSafeObject<P>();
			}
		}
		return this._params;
	}
	public set params(value: P) {
		this._params = value;
	}
}

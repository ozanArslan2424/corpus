import { Cookies } from "@/Cookies/Cookies";
import { HeaderKey } from "@/enums/HeaderKey";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import type { ContextDataInterface } from "@/types";
import { isEmpty } from "@/utils/is";
import type { SchemaValidator } from "@/utils/Schema";
import { strSplit } from "@/utils/strings";

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

export class Context<B = unknown, S = unknown, P = unknown, R = unknown> {
	constructor(public readonly req: Request) {}

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
		if (!this._url.pathname) this._url.pathname += "/";
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

	data: ContextDataInterface = Object.create(null);
	body: B = Object.create(null);
	search: S = Object.create(null);
	params: P = Object.create(null);

	async parseData(input: {
		params: Record<string, string>;
		bodyValidator?: SchemaValidator<any> | undefined;
		searchValidator?: SchemaValidator<any>;
		paramsValidator?: SchemaValidator<any>;
	}) {
		const body = await $registry.bodyParser.parse(this.req);
		this.body = await $registry.schemaParser.parse("body", body, input?.bodyValidator);

		const qIndex = this.req.url.indexOf("?");
		if (qIndex !== -1) {
			const search = $registry.searchParamsParser.parse(
				new URLSearchParams(this.req.url.slice(qIndex + 1)),
			);
			this.search = await $registry.schemaParser.parse("search", search, input?.searchValidator);
		}

		if (!isEmpty(input.paramsValidator)) {
			const params = $registry.urlParamsParser.parse(input.params);
			this.params = await $registry.schemaParser.parse("params", params, input?.paramsValidator);
		}
	}
}

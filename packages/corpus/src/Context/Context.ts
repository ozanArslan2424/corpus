import type { Cookies } from "@/Cookies/Cookies";
import { $registry } from "@/registry";
import { Req } from "@/Req/Req";
import { Res } from "@/Res/Res";
import type { RouterReturn } from "@/Router/types";
import type { ContextDataInterface } from "@/types";

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
	constructor(req: Req, res?: Res<R>) {
		this.req = req;
		this.url = req.urlObject;
		this.headers = req.headers;
		this.cookies = req.cookies;
		this.res = res ?? new Res<R>();
	}

	req: Req;
	res: Res<R>;
	url: URL;
	headers: Headers;
	cookies: Cookies;
	body: B = Object.create(null);
	search: S = Object.create(null);
	params: P = Object.create(null);
	data: ContextDataInterface = Object.create(null);

	static async appendParsedData<B = unknown, S = unknown, P = unknown, R = unknown>(
		ctx: Context<B, S, P, R>,
		match: RouterReturn,
	) {
		// Clone the request before the body parser consumes the stream, so the
		// consumer can still call c.req.formData()/json()/text() without hitting
		// the "body already consumed" error.
		const clone = new Req(ctx.req.clone());

		const body = await $registry.bodyParser.parse(ctx.req);
		const search = $registry.searchParamsParser.parse(ctx.url.searchParams);
		const params = $registry.urlParamsParser.parse(match.params);

		if (body instanceof ReadableStream) {
			ctx.body = body as B;
		} else {
			ctx.body = await $registry.schemaParser.parse("body", body, match.route.validators?.body);
		}
		ctx.search = await $registry.schemaParser.parse(
			"search",
			search,
			match.route.validators?.search,
		);
		ctx.params = await $registry.schemaParser.parse(
			"params",
			params,
			match.route.validators?.params,
		);

		ctx.req = clone;
	}
}

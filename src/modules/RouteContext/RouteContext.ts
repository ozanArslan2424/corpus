import { HttpRequest } from "@/modules/HttpRequest/HttpRequest";
import type { HttpRequestInterface } from "@/modules/HttpRequest/HttpRequestInterface";
import { Parser } from "@/modules/Parser/Parser";
import { RouteContextAbstract } from "@/modules/RouteContext/RouteContextAbstract";
import type { RouteContextInterface } from "@/modules/RouteContext/RouteContextInterface";
import type { RouteInterface } from "@/modules/Route/RouteInterface";

/**
 * The context object used in Route "callback" parameter.
 * Takes 5 generics:
 * D = Data passed through a {@link Middleware}
 * R = The return type
 * B = Request body
 * S = Request URL search params
 * P = Request URL params
 * The types are resolved using Route "schemas" parameter except D
 * which you may want to pass if you have middleware data.
 *
 * Contains:
 * req = {@link Request} instance
 * url = Request URL
 * body = Async function to get the parsed Request body
 * search = Parsed Request URL search params
 * params = Parsed Request URL params
 * status = To set the Response status
 * statusText = To set the Response statusText
 * headers = To set the Response {@link Headers}
 * cookies = To set the Response {@link Cookies}
 * */

export class RouteContext<R = unknown, B = unknown, S = unknown, P = unknown>
	extends RouteContextAbstract<R, B, S, P>
	implements RouteContextInterface<R, B, S, P>
{
	static async makeFromRequest<
		Path extends string = string,
		R = unknown,
		B = unknown,
		S = unknown,
		P = unknown,
	>(
		request: HttpRequestInterface,
		route: RouteInterface<Path, R, B, S, P>,
	): Promise<RouteContextInterface<R, B, S, P>> {
		const req = new HttpRequest(request);
		console.log(req.url);
		const url = new URL(req.url);
		console.log(url.toString());
		const headers = req.headers;
		const cookies = req.cookies;

		const body = await Parser.getBody(req, route.schemas?.body);
		const search = await Parser.getSearch(url, route.schemas?.search);
		const params = await Parser.getParams(
			route.path,
			url,
			route.schemas?.params,
		);

		return new RouteContext(req, url, headers, cookies, body, search, params);
	}
}

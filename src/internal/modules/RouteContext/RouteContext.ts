import { CoreumRequest } from "@/internal/modules/CoreumRequest/CoreumRequest";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import { CoreumResponse } from "@/internal/modules/CoreumResponse/CoreumResponse";
import { RequestParser } from "@/internal/modules/Parser/RequestParser";
import { RouteContextAbstract } from "@/internal/modules/RouteContext/RouteContextAbstract";
import type { RouteContextInterface } from "@/internal/modules/RouteContext/RouteContextInterface";
import type { Endpoint } from "@/internal/types/Endpoint";
import type { RouteSchemas } from "@/internal/types/RouteSchemas";

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

export class RouteContext<B = unknown, S = unknown, P = unknown>
	extends RouteContextAbstract<B, S, P>
	implements RouteContextInterface<B, S, P>
{
	static async makeFromRequest<
		Path extends string = string,
		R = unknown,
		B = unknown,
		S = unknown,
		P = unknown,
	>(
		request: CoreumRequestInterface,
		path: Endpoint<Path>,
		model?: RouteSchemas<R, B, S, P>,
	): Promise<RouteContextInterface<B, S, P>> {
		const requestParser = new RequestParser();

		const req = new CoreumRequest(request);
		const url = new URL(req.url);
		const headers = req.headers;
		const cookies = req.cookies;
		const body = await requestParser.getBody(req, model?.body);
		const search = requestParser.getSearch(url, model?.search);
		const params = requestParser.getParams(path, url, model?.params);

		const res = new CoreumResponse();

		return new RouteContext(
			req,
			url,
			headers,
			cookies,
			body,
			search,
			params,
			res,
		);
	}
}

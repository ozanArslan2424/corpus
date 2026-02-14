import type { CorsInterface } from "@/modules/Cors/CorsInterface";
import type { CorsOptions } from "@/modules/Cors/types/CorsOptions";
import { isSomeArray } from "@/utils/isSomeArray";
import { toStringBool } from "@/utils/toStringBool";
import type { HttpRequestInterface } from "@/modules/HttpRequest/HttpRequestInterface";
import type { HttpResponseInterface } from "@/modules/HttpResponse/HttpResponseInterface";

export abstract class CorsAbstract implements CorsInterface {
	constructor(readonly opts: CorsOptions) {}

	private readonly originKey = "Access-Control-Allow-Origin";
	private readonly methodsKey = "Access-Control-Allow-Methods";
	private readonly headersKey = "Access-Control-Allow-Headers";
	private readonly credentialsKey = "Access-Control-Allow-Credentials";

	public getCorsHeaders(req: HttpRequestInterface, res: HttpResponseInterface) {
		const reqOrigin = req.headers.get("origin") ?? "";

		const { allowedOrigins, allowedMethods, allowedHeaders, credentials } =
			this.opts;

		if (isSomeArray(allowedOrigins) && allowedOrigins.includes(reqOrigin)) {
			res.headers.set(this.originKey, reqOrigin);
		}

		if (isSomeArray(allowedMethods)) {
			res.headers.set(this.methodsKey, allowedMethods.join(", "));
		}

		if (isSomeArray(allowedHeaders)) {
			res.headers.set(this.headersKey, allowedHeaders.join(", "));
		}

		res.headers.set(this.credentialsKey, toStringBool(credentials));

		return res.headers;
	}

	apply(req: HttpRequestInterface, res: HttpResponseInterface): void {
		const headers = this.getCorsHeaders(req, res);
		res.headers.innerCombine(headers);
	}
}

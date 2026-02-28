import type { HttpRequest } from "@/Request/HttpRequest";
import type { HttpResponse } from "@/Response/HttpResponse";
import type { CorsOptions } from "@/Cors/types/CorsOptions";
import { boolToString } from "@/utils/boolToString";
import { isSomeArray } from "@/utils/isSomeArray";

/** Simple cors helper object to set cors headers */

export class Cors {
	constructor(readonly opts: CorsOptions) {}

	private readonly originKey = "Access-Control-Allow-Origin";
	private readonly methodsKey = "Access-Control-Allow-Methods";
	private readonly headersKey = "Access-Control-Allow-Headers";
	private readonly credentialsKey = "Access-Control-Allow-Credentials";

	getCorsHeaders(req: HttpRequest, res: HttpResponse) {
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

		res.headers.set(this.credentialsKey, boolToString(credentials));

		return res.headers;
	}

	apply(req: HttpRequest, res: HttpResponse): void {
		const headers = this.getCorsHeaders(req, res);
		res.headers.innerCombine(headers);
	}
}

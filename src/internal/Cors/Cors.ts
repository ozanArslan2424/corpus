import type { CorsConfig } from "@/internal/Cors/CorsConfig";
import { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";
import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";
import { isSomeArray } from "@/utils/isSomeArray";
import { toStringBool } from "@/utils/toStringBool";

export class Cors {
	constructor(readonly config: CorsConfig) {}

	private readonly originKey = "Access-Control-Allow-Origin";
	private readonly methodsKey = "Access-Control-Allow-Methods";
	private readonly headersKey = "Access-Control-Allow-Headers";
	private readonly credentialsKey = "Access-Control-Allow-Credentials";

	public getCorsHeaders(req: CoreumRequest, res: CoreumResponse) {
		const reqOrigin = req.headers.get("origin") ?? "";
		const headers = new CoreumHeaders(res.headers);

		const { allowedOrigins, allowedMethods, allowedHeaders, credentials } =
			this.config;

		if (isSomeArray(allowedOrigins) && allowedOrigins.includes(reqOrigin)) {
			headers.set(this.originKey, reqOrigin);
		}

		if (isSomeArray(allowedMethods)) {
			headers.set(this.methodsKey, allowedMethods.join(", "));
		}

		if (isSomeArray(allowedHeaders)) {
			headers.set(this.headersKey, allowedHeaders.join(", "));
		}

		headers.set(this.credentialsKey, toStringBool(credentials));

		return headers;
	}
}

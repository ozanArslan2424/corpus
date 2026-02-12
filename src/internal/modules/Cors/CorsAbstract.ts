import type { CorsInterface } from "@/internal/modules/Cors/CorsInterface";

import { CoreumHeaders } from "@/internal/modules/CoreumHeaders/CoreumHeaders";
import type { CoreumRequest } from "@/internal/modules/CoreumRequest/CoreumRequest";
import type { CoreumResponse } from "@/internal/modules/CoreumResponse/CoreumResponse";

import type { CorsConfig } from "@/internal/types/CorsConfig";

import { isSomeArray } from "@/internal/utils/isSomeArray";
import { toStringBool } from "@/internal/utils/toStringBool";

export abstract class CorsAbstract implements CorsInterface {
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

	apply(req: CoreumRequest, res: CoreumResponse): void {
		const headers = this.getCorsHeaders(req, res);
		res.headers.innerCombine(headers);
	}
}

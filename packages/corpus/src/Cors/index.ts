import { getNearestApp } from "@/AppsRegistry";
import type { ContextHandler } from "@/Context";
import { HeaderKey } from "@/Headers";
import { Res, Status } from "@/Res";
import { isSomeArray } from "@/utils/array";
import { boolString } from "@/utils/boolean";

type CorsOptions = {
	/** Which origins are allowed to access the resource. Use ["*"] for any origin, or specific domains. */
	allowedOrigins?: string[];

	/** Which HTTP methods are allowed (GET, POST, etc.) */
	allowedMethods?: string[];

	/** Which headers can be sent in the request */
	allowedHeaders?: HeaderKey[];

	/** Which headers should be exposed to the client/browser JavaScript
	 * These are response headers that the client can read
	 * @example ['RateLimit-Limit', 'RateLimit-Remaining', 'X-Custom-Header']
	 */
	exposedHeaders?: HeaderKey[];

	/** Whether to expose cookies and auth headers to the client */
	credentials?: boolean;

	/** How long (in seconds) browsers can cache preflight results. Default: 86400 (24 hours) */
	maxAge?: number;
	includeMaxAgeResponseHeader?: boolean;
};

interface CorsInterface {
	opts?: CorsOptions;
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
	handler: ContextHandler;
}

class Cors implements CorsInterface {
	constructor(public opts?: CorsOptions) {
		this.register();
	}

	register(): void {
		getNearestApp().cors = this;
	}

	handler: ContextHandler = (c) => {
		this.applyHeaders(c.res.headers, c.req.headers.get("origin") ?? "");
	};

	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler = (c) => {
		const res = new Res(undefined, { status: Status.NO_CONTENT });
		this.applyHeaders(res.headers, c.req.headers.get("origin") ?? "", true);
		return res;
	};

	/** Applies CORS headers to a Headers object given the request origin. */
	protected applyHeaders(headers: Headers, reqOrigin: string, includeMaxAge = false): void {
		const {
			allowedOrigins,
			allowedMethods,
			allowedHeaders,
			exposedHeaders,
			credentials,
			maxAge = 86400,
		} = this.opts ?? {};

		const isWildcard = !allowedOrigins || allowedOrigins.includes("*");
		const originAllowed = !isWildcard && allowedOrigins.includes(reqOrigin);

		// Credentials mode forbids wildcard origin — reflect actual origin instead
		if (credentials && isWildcard && reqOrigin) {
			headers.set(HeaderKey.AccessControlAllowOrigin, reqOrigin);
			headers.append(HeaderKey.Vary, "Origin");
		} else if (isWildcard) {
			headers.set(HeaderKey.AccessControlAllowOrigin, "*");
		} else if (originAllowed) {
			headers.set(HeaderKey.AccessControlAllowOrigin, reqOrigin);
			headers.append(HeaderKey.Vary, "Origin");
		}

		if (isSomeArray(allowedMethods)) {
			headers.set(HeaderKey.AccessControlAllowMethods, allowedMethods.join(", "));
		}

		if (isSomeArray(allowedHeaders)) {
			headers.set(HeaderKey.AccessControlAllowHeaders, allowedHeaders.join(", "));
		}

		if (isSomeArray(exposedHeaders)) {
			headers.set(HeaderKey.AccessControlExposeHeaders, exposedHeaders.join(", "));
		}

		if (includeMaxAge) {
			headers.set(HeaderKey.AccessControlMaxAge, maxAge.toString());
		}

		headers.set(HeaderKey.AccessControlAllowCredentials, boolString(credentials));
	}
}

export type { CorsInterface };
export { Cors };

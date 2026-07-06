import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import type { CorsInterface } from "@/Cors/CorsInterface";
import type { CorsOptions } from "@/Cors/CorsOptions";
import type { MiddlewareHandler } from "@/Middleware/MiddlewareHandler";
import type { MiddlewareUseOn } from "@/Middleware/MiddlewareUseOn";
import { MiddlewareVariant } from "@/Middleware/MiddlewareVariant";
import { $registry } from "@/registry";
import { Res } from "@/Res/Res";
import type { RequestHandler } from "@/Server/RequestHandler";
import { Status } from "@/Status/Status";
import { isSomeArray } from "@/utils/arrays";
import { boolToString } from "@/utils/booleans";

/**
 * Simple cors helper to set CORS headers. Also provides a preflight handler for the Server.
 * Extend and override to change business logic and keep registration.
 * */
export class Cors implements CorsInterface {
	constructor(protected readonly opts: CorsOptions | undefined) {
		this.register();
	}

	register() {
		$registry.cors = this;
	}

	variant: MiddlewareVariant = MiddlewareVariant.outbound;
	useOn: MiddlewareUseOn = "*";
	handler: MiddlewareHandler = (c) => {
		this.applyHeaders(c.res, c.headers.get("origin") ?? "");
	};

	/** Applies CORS headers to a Headers object given the request origin. */
	protected applyHeaders(res: Res, reqOrigin: string, includeMaxAge = false): void {
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
			res.headers.set(CommonHeaders.AccessControlAllowOrigin, reqOrigin);
			res.headers.append(CommonHeaders.Vary, "Origin");
		} else if (isWildcard) {
			res.headers.set(CommonHeaders.AccessControlAllowOrigin, "*");
		} else if (originAllowed) {
			res.headers.set(CommonHeaders.AccessControlAllowOrigin, reqOrigin);
			res.headers.append(CommonHeaders.Vary, "Origin");
		}

		if (isSomeArray(allowedMethods)) {
			res.headers.set(CommonHeaders.AccessControlAllowMethods, allowedMethods.join(", "));
		}

		if (isSomeArray(allowedHeaders)) {
			res.headers.set(CommonHeaders.AccessControlAllowHeaders, allowedHeaders.join(", "));
		}

		if (isSomeArray(exposedHeaders)) {
			res.headers.set(CommonHeaders.AccessControlExposeHeaders, exposedHeaders.join(", "));
		}

		if (includeMaxAge) {
			res.headers.set(CommonHeaders.AccessControlMaxAge, maxAge.toString());
		}

		res.headers.set(CommonHeaders.AccessControlAllowCredentials, boolToString(credentials));
	}

	/** Preflight handler for OPTIONS requests. */
	getPreflightHandler(): RequestHandler {
		return (req) => {
			const res = new Res(undefined, { status: Status.NO_CONTENT });
			this.applyHeaders(res, req.headers.get("origin") ?? "", true);
			return res;
		};
	}
}

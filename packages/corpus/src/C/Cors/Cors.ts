import { isSomeArray, boolToString } from "@/utils";

import type { CorsOptions } from "@/C/Cors/Cors.types";
import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import type { MiddlewareUseOn, MiddlewareHandler } from "@/C/Middleware/Middleware.types";
import { Res } from "@/C/Res/Res";
import type { ContextHandler } from "@/C/Route/Route.types";
import { Status } from "@/C/Status/Status";
import { $registry } from "@/Registry/$registry";
import type { CorsInterface } from "@/Registry/Registry.types";

/**
 * Simple cors helper to set CORS headers. Also provides a preflight handler for the Server.
 * Extend and override to change business logic and keep registration.
 * */
export class Cors implements CorsInterface {
	constructor(public opts: CorsOptions | undefined) {
		this.register();
	}

	register(): void {
		$registry.register("cors", this);
	}

	useOn: MiddlewareUseOn = "*";
	handler: MiddlewareHandler = async (c, next) => {
		await next();
		this.applyHeaders(c.res, c.req.headers.get("origin") ?? "");
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
			res.headers.set(HeaderKey.AccessControlAllowOrigin, reqOrigin);
			res.headers.append(HeaderKey.Vary, "Origin");
		} else if (isWildcard) {
			res.headers.set(HeaderKey.AccessControlAllowOrigin, "*");
		} else if (originAllowed) {
			res.headers.set(HeaderKey.AccessControlAllowOrigin, reqOrigin);
			res.headers.append(HeaderKey.Vary, "Origin");
		}

		if (isSomeArray(allowedMethods)) {
			res.headers.set(HeaderKey.AccessControlAllowMethods, allowedMethods.join(", "));
		}

		if (isSomeArray(allowedHeaders)) {
			res.headers.set(HeaderKey.AccessControlAllowHeaders, allowedHeaders.join(", "));
		}

		if (isSomeArray(exposedHeaders)) {
			res.headers.set(HeaderKey.AccessControlExposeHeaders, exposedHeaders.join(", "));
		}

		if (includeMaxAge) {
			res.headers.set(HeaderKey.AccessControlMaxAge, maxAge.toString());
		}

		res.headers.set(HeaderKey.AccessControlAllowCredentials, boolToString(credentials));
	}

	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler = (c) => {
		const res = new Res(undefined, { status: Status.NO_CONTENT });
		this.applyHeaders(res, c.req.headers.get("origin") ?? "", true);
		return res;
	};
}

import type { CorsOptions } from "@/Cors/types";
import { CommonHeaders } from "@/enums/CommonHeaders";
import { Status } from "@/enums/Status";
import {
	MiddlewareVariant,
	type MiddlewareUseOn,
	type MiddlewareHandler,
} from "@/Middleware/types";
import { $registry } from "@/registry";
import type { CorsInterface } from "@/Registry/types";
import { Res } from "@/Res/Res";
import type { RequestHandler } from "@/Server/types";
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
		this.applyCHeaders(c.res, c.headers.get("origin") ?? "");
	};

	/** Applies CORS headers to a CHeaders object given the request origin. */
	protected applyCHeaders(res: Res, reqOrigin: string, includeMaxAge = false): void {
		const {
			allowedOrigins,
			allowedMethods,
			allowedCHeaders,
			exposedCHeaders,
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

		if (isSomeArray(allowedCHeaders)) {
			res.headers.set(CommonHeaders.AccessControlAllowCHeaders, allowedCHeaders.join(", "));
		}

		if (isSomeArray(exposedCHeaders)) {
			res.headers.set(CommonHeaders.AccessControlExposeCHeaders, exposedCHeaders.join(", "));
		}

		if (includeMaxAge) {
			res.headers.set(CommonHeaders.AccessControlMaxAge, maxAge.toString());
		}

		res.headers.set(CommonHeaders.AccessControlAllowCredentials, boolToString(credentials));
	}

	/** Preflight handler for OPTIONS requests. */
	handlePreflight: RequestHandler = (req) => {
		const res = new Res(undefined, { status: Status.NO_CONTENT });
		this.applyCHeaders(res, req.headers.get("origin") ?? "", true);
		return res;
	};
}

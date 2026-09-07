/**
 * Cross-origin resource sharing.
 *
 * Constructing a {@link Cors} attaches it to the nearest {@link App}, which then
 * calls it from two places: {@link App.respond} runs {@link Cors.handler} on
 * every outgoing response, after the {@link Middleware} chain has finished, and
 * {@link App.handlePreflight} delegates to {@link Cors.handlePreflight} for
 * `OPTIONS` requests carrying
 * {@link HeaderKey.AccessControlRequestMethod}. Running last is deliberate — a
 * middleware that short-circuits the chain cannot drop the CORS headers.
 *
 * With no {@link Cors} attached, an app answers preflights with
 * {@link Status.NO_CONTENT} and sends no CORS headers at all.
 *
 * ```ts
 * import { Cors } from "@ozanarslan/corpus";
 *
 * new Cors({ allowedOrigins: ["https://example.com"], credentials: true });
 * ```
 *
 * @module Cors
 */

import { getNearestApp } from "@/AppsRegistry";
import type { ContextHandler } from "@/Context";
import { HeaderKey } from "@/Headers";
import { Res, Status } from "@/Res";
import { isSomeArray } from "@/utils/array";
import { boolString } from "@/utils/boolean";

/**
 * The CORS policy. Every field is optional; an omitted field means the
 * corresponding header is not sent, with the exception of the origin, which
 * falls back to a wildcard.
 */
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
	/**
	 * Whether {@link HeaderKey.AccessControlMaxAge} is sent on ordinary responses
	 * as well as on preflights. Preflights always carry it; browsers ignore it
	 * elsewhere.
	 */
	includeMaxAgeResponseHeader?: boolean;
};

/**
 * The public shape of a CORS policy, implemented by {@link Cors}. This is the
 * type {@link App.cors} holds, so a custom policy only has to satisfy the
 * contract.
 */
interface CorsInterface {
	/** The configured {@link CorsOptions}. */
	opts?: CorsOptions;
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
	/** Applies CORS headers to an outgoing response. */
	handler: ContextHandler;
}

/**
 * Default {@link CorsInterface} implementation.
 *
 * Both entry points share {@link Cors.applyHeaders}, so a preflight and a real
 * response describe the same policy. The preflight builds a fresh
 * {@link Status.NO_CONTENT} {@link Res} — it never reaches a route handler —
 * while the response path writes onto the {@link Res} that is already being
 * returned.
 */
class Cors implements CorsInterface {
	/**
	 * Creates a policy and attaches it to the nearest {@link App}.
	 *
	 * @param opts - The {@link CorsOptions} to enforce. Omitting them yields a
	 * permissive wildcard origin with no method, header or exposure restrictions.
	 */
	constructor(public opts?: CorsOptions) {
		this.register();
	}

	/**
	 * Attaches this policy to the nearest {@link App}, replacing any policy
	 * already set. Called by the constructor; an app holds exactly one.
	 */
	register(): void {
		getNearestApp().cors = this;
	}

	/**
	 * Adds the CORS headers to an outgoing response.
	 *
	 * Called by {@link App.respond} for every response, after the handler chain
	 * has produced its result.
	 *
	 * @param c - The {@link Context} for the request, read for its `Origin` header
	 * and written to through {@link Context.res}.
	 */
	handler: ContextHandler = (c) => {
		this.applyHeaders(c.res.headers, c.req.headers.get("origin") ?? "");
	};

	/**
	 * Preflight handler for OPTIONS requests.
	 *
	 * Answers with an empty {@link Status.NO_CONTENT} response carrying the full
	 * policy, including {@link HeaderKey.AccessControlMaxAge} so the browser can
	 * cache the result and skip the round trip on subsequent requests.
	 *
	 * @param c - The {@link Context} for the preflight request.
	 * @returns The preflight {@link Res}.
	 */
	handlePreflight: ContextHandler = (c) => {
		const res = new Res(undefined, { status: Status.NO_CONTENT });
		this.applyHeaders(res.headers, c.req.headers.get("origin") ?? "", true);
		return res;
	};

	/**
	 * Applies CORS headers to a Headers object given the request origin.
	 *
	 * Origin resolution has three outcomes. A wildcard policy sends `*`. A policy
	 * listing origins sends the request's own origin when it is listed, and no
	 * origin header at all when it is not — an unlisted origin is rejected by
	 * omission rather than by an error status. A wildcard policy combined with
	 * `credentials` reflects the request origin instead of `*`, because the spec
	 * forbids the wildcard in credentialed mode. Whenever the origin is reflected,
	 * {@link HeaderKey.Vary} is appended so caches key on it.
	 *
	 * The remaining list headers are written only when their option is a non-empty
	 * array, so an unset method or header list leaves the browser's defaults
	 * alone.
	 *
	 * @param headers - The response headers to write into.
	 * @param reqOrigin - The request's `Origin` header, or an empty string when it
	 * sent none.
	 * @param includeMaxAge - Whether to send
	 * {@link HeaderKey.AccessControlMaxAge}. Set for preflights, where it governs
	 * how long the browser caches the result. Defaults to `false`.
	 */
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

export { Cors };
export type { CorsInterface };

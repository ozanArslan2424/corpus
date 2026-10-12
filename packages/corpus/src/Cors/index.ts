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

import type { ContextHandler } from "@/Context";
import { getNearestApp } from "@/Globals/AppsRegistry";
import { HeaderKey, type HeadersInitValue } from "@/Headers";
import { Res, Status } from "@/Res";
import { isSomeArray, type Optional } from "@/utils/is";
import { memo } from "@/utils/memo";

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
};

/**
 * The public shape of a CORS policy, implemented by {@link Cors}. This is the
 * type {@link App.cors} holds, so a custom policy only has to satisfy the
 * contract.
 */
interface CorsInterface {
	/** The configured {@link CorsOptions}. */
	options?: CorsOptions;
	/** Preflight handler for OPTIONS requests. */
	handlePreflight: ContextHandler;
	/** Applies CORS headers to an outgoing response. */
	handler: ContextHandler;
}

/**
 * Whether a policy allows any origin: no list at all, or a list containing the
 * wildcard.
 *
 * @param allowedOrigins - The configured origins, if any.
 * @returns `true` when no origin is being restricted.
 */
function isWildcardPolicy(allowedOrigins: Optional<string[]>): boolean {
	return !allowedOrigins || allowedOrigins.includes("*");
}

/**
 * Whether `Vary` already accounts for the origin.
 *
 * A `Vary: *` covers every request header, so it needs no addition either.
 * Matching is case-insensitive and token-aware, so a header listing
 * `Accept-Encoding, Origin` is recognised while one listing `Origin-Policy` is
 * not.
 *
 * @param headers - The response headers to inspect.
 * @returns `true` when appending `Origin` would be redundant.
 */
function isOriginInVaryHeader(headers: Headers): boolean {
	const vary = headers.get(HeaderKey.Vary);
	if (!vary) return false;
	for (const token of vary.split(",")) {
		const trimmed = token.trim();
		if (trimmed === "*" || trimmed.toLowerCase() === "origin") return true;
	}
	return false;
}

/**
 * Everything in a policy that does not depend on the request: the method,
 * header and exposure lists, the max-age, and the credentials flag.
 *
 * Keyed on the {@link Cors} itself and on `includeMaxAge`. The policy is held
 * weakly, so entries never cross between policies and go away with the
 * instance that built them. `includeMaxAge` has two values: an ordinary
 * response and a preflight differ only in that header.
 *
 * The entries are built on the first response and reused from then on, so a
 * policy whose {@link Cors.options} change afterwards — reassigned or mutated in
 * place — keeps serving the headers it was first called with.
 *
 * The returned array is reused for every later response, so callers must read
 * it and not mutate it.
 *
 * @param cors - The policy to read, and the key the entries are cached under.
 * @param includeMaxAge - Whether to carry
 * {@link HeaderKey.AccessControlMaxAge}.
 * @returns The header entries, ready for `setMany`.
 */
const getStaticHeaders = memo(
	(cors: CorsInterface, includeMaxAge: boolean): Array<[string, HeadersInitValue]> => {
		const {
			allowedMethods,
			allowedHeaders,
			exposedHeaders,
			credentials,
			maxAge = 86400,
		} = cors.options ?? {};

		const entries: Array<[string, HeadersInitValue]> = [];

		if (isSomeArray(allowedMethods)) {
			entries.push([HeaderKey.AccessControlAllowMethods, allowedMethods.join(", ")]);
		}

		if (isSomeArray(allowedHeaders)) {
			entries.push([HeaderKey.AccessControlAllowHeaders, allowedHeaders.join(", ")]);
		}

		if (isSomeArray(exposedHeaders)) {
			entries.push([HeaderKey.AccessControlExposeHeaders, exposedHeaders.join(", ")]);
		}

		if (includeMaxAge) {
			entries.push([HeaderKey.AccessControlMaxAge, maxAge]);
		}

		// Sending this as "false" is noise since it does nothing.
		if (credentials) {
			entries.push([HeaderKey.AccessControlAllowCredentials, true]);
		}

		return entries;
	},
);

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
	 * @param options - The {@link CorsOptions} to enforce. Omitting them yields a
	 * permissive wildcard origin with no method, header or exposure restrictions.
	 */
	constructor(readonly options?: CorsOptions) {
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
	 * Origin resolution has two outcomes. A wildcard policy sends `*`, including
	 * in credentialed mode — the spec forbids that combination, and the browser
	 * is what rejects it. A policy listing origins sends the request's own origin
	 * when it is listed, and no origin header at all when it is not: an unlisted
	 * origin is rejected by omission rather than by an error status.
	 *
	 * A restricted policy also appends {@link HeaderKey.Vary}, whether or not the
	 * origin was allowed: the response differs by origin either way, so a shared
	 * cache that did not key on it could hand one origin's response to another.
	 * An existing `Vary` that already lists `Origin` is left alone.
	 *
	 * Everything else comes from {@link getStaticHeaders} and goes out in one
	 * `setMany`, so the per-request work here is the origin alone.
	 *
	 * @param headers - The response headers to write into.
	 * @param reqOrigin - The request's `Origin` header, or an empty string when it
	 * sent none.
	 * @param includeMaxAge - Whether to send
	 * {@link HeaderKey.AccessControlMaxAge}. Set for preflights, where it governs
	 * how long the browser caches the result. Defaults to `false`.
	 */
	protected applyHeaders(headers: Headers, reqOrigin: string, includeMaxAge = false): void {
		const allowedOrigins = this.options?.allowedOrigins;

		if (isWildcardPolicy(allowedOrigins)) {
			headers.set(HeaderKey.AccessControlAllowOrigin, "*");
		} else {
			if (allowedOrigins?.includes(reqOrigin)) {
				headers.set(HeaderKey.AccessControlAllowOrigin, reqOrigin);
			}
			if (!isOriginInVaryHeader(headers)) headers.append(HeaderKey.Vary, "Origin");
		}

		headers.setMany(getStaticHeaders(this, includeMaxAge));
	}
}

export { Cors, type CorsInterface };

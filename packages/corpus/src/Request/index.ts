/**
 * HTTP method constants, and the `Request` extensions the framework relies on.
 *
 * {@link Method} gives the verbs as documented constants. {@link patchGlobalRequest}
 * then adds two properties to the global `Request`: `params`, which {@link App}
 * fills with the matched path parameters before parsing, and `cookies`, which
 * parses the `Cookie` header into a {@link Cookies} map on first access.
 *
 * Like {@link patchGlobalHeaders}, this must be installed once at startup,
 * before any request is served.
 *
 * @module Request
 */

import { Cookies, parseCookieHeader } from "@/Cookies";
import { readHeader, HeaderKey } from "@/Headers";
import { enumerate, type ValueOf } from "@/utils/enum";
import type { OrString } from "@/utils/lexical";
import { createSafeObject } from "@/utils/object";
import { lazy, type LazyMut } from "@/utils/variable";

/** Commonly used HTTP verbs. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) for the full spec. */
const Method = enumerate({
	/** Retrieve a resource from the server. */
	GET: "GET",
	/** Submit data to create a new resource. */
	POST: "POST",
	/** Replace an entire resource with new data. */
	PUT: "PUT",
	/** Apply partial modifications to a resource. */
	PATCH: "PATCH",
	/** Remove a resource from the server. */
	DELETE: "DELETE",
	/** Get response headers without body. */
	HEAD: "HEAD",
	/** Discover communication options. */
	OPTIONS: "OPTIONS",
	/** Establish tunnel to server. */
	CONNECT: "CONNECT",
	/** Echo back received request. */
	TRACE: "TRACE",
});

/**
 * An HTTP method. The {@link Method} constants are suggested, but
 * {@link OrString} keeps any custom verb assignable.
 */
type Method = OrString<ValueOf<typeof Method>>;

/**
 * Builds the lazy {@link Cookies} accessor a request exposes.
 *
 * Parsing is deferred until something reads `request.cookies`, so a request that
 * never touches cookies never pays for the header. Cookies passed in the init
 * are used as the starting map, with anything from the `Cookie` header layered
 * on top.
 *
 * @param init - The request init, read for an existing {@link Cookies} map and
 * for the `Cookie` header.
 * @returns A mutable lazy holding the cookie map, so assigning
 * `request.cookies` can replace it wholesale.
 */
function requestCookiesFactory(init?: RequestInit): LazyMut<Cookies> {
	return lazy.mut(() => {
		const cookies = init?.cookies ?? new Cookies();
		const cookieHeader = readHeader(init?.headers, HeaderKey.Cookie);
		if (!cookieHeader) return cookies;
		for (const cookie of parseCookieHeader(cookieHeader)) {
			cookies.set(cookie);
		}
		return cookies;
	});
}

/**
 * Installs `params` and `cookies` on the global `Request`. Call it once at
 * startup, before any request is served.
 *
 * The patch is applied twice over, for the same reason as
 * {@link patchGlobalHeaders}. The prototype is extended so requests *the runtime*
 * creates — every incoming request Bun hands to the server — carry the
 * properties, since those never pass through a constructor the framework
 * controls. The global class is then replaced too, so manually constructed
 * requests can seed their cookies from {@link RequestInit.cookies}, which the
 * prototype path has no access to.
 *
 * The subclass overrides `Symbol.hasInstance` to defer to the native class, so
 * `instanceof Request` stays true for requests created outside the patch.
 */
function patchGlobalRequest() {
	const NativeRequest = globalThis.Request;

	/** The request as seen internally, with its lazy cookie backing store. */
	interface WithPrivates extends Request {
		/** Backing store for `cookies`, created on first access. */
		_cookies: LazyMut<Cookies>;
	}

	// For Request objects constructed with Bun
	Object.defineProperties(Request.prototype, {
		params: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: createSafeObject(),
		},
		_cookies: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: undefined,
		},
		cookies: {
			configurable: true,
			enumerable: false,
			get(this: WithPrivates) {
				if (!this._cookies) {
					this._cookies = requestCookiesFactory({ headers: this.headers });
				}
				return this._cookies();
			},
			set(this: WithPrivates, value: Cookies) {
				if (!this._cookies) {
					this._cookies = requestCookiesFactory({ headers: this.headers });
				}
				this._cookies.set(value);
			},
		},
	});

	// For Request objects constructed manually
	globalThis.Request = class extends NativeRequest {
		/**
		 * Creates a request, seeding its cookies from the init.
		 *
		 * @param input - The URL or request to build from.
		 * @param init - The request init. {@link RequestInit.cookies} and the
		 * `Cookie` header both feed the cookie map.
		 */
		constructor(input: RequestInfo | URL, init?: RequestInit) {
			super(input, init);
			this._cookies = requestCookiesFactory(init);
			this.params = createSafeObject();
		}

		/**
		 * Defers `instanceof` to the native class, so requests created by the
		 * runtime still satisfy `instanceof Request`.
		 *
		 * @param value - The value being tested.
		 * @returns `true` when it is a native `Request`.
		 */
		static override [Symbol.hasInstance](value: unknown): boolean {
			return value instanceof NativeRequest;
		}

		/**
		 * The raw path parameters matched by the route, populated by Bun's router.
		 * The declaration here only types them and supplies an empty default for
		 * manually constructed requests. Read {@link Context.params} instead for the
		 * parsed and validated values; {@link App} additionally lifts a wildcard
		 * segment into the `*` key, which Bun does not provide.
		 */
		override params: { [x: string]: string };

		/** Backing store for {@link Request.cookies}, parsed on first access. */
		private _cookies: LazyMut<Cookies>;

		/**
		 * The request's cookies, parsed from the `Cookie` header on first access.
		 *
		 * @returns The {@link Cookies} map.
		 */
		override get cookies(): Cookies {
			return this._cookies();
		}

		override set cookies(value: Cookies) {
			this._cookies.set(value);
		}
	};
}

declare global {
	interface RequestInit {
		/**
		 * Cookies to seed the request with. Anything in the `Cookie` header is
		 * layered on top of these.
		 */
		cookies?: Cookies;
	}
	/** The `Request` surface after {@link patchGlobalRequest} has run. */
	interface Request {
		/**
		 * The raw path parameters matched by the route, populated by Bun's router.
		 * {@link Context.params} holds the parsed, validated version.
		 */
		params: { [x: string]: string };
		/** The request's cookies, parsed from the `Cookie` header on first access. */
		cookies: Cookies;
	}
}

export { patchGlobalRequest, Method };

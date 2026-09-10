/**
 * Header names, header-value builders, and the `Headers` extensions the
 * framework relies on.
 *
 * Two things happen here. {@link HeaderKey} gives the common header names as
 * documented constants, so header access is autocompleted and typo-free rather
 * than stringly typed. {@link patchGlobalHeaders} then extends the global
 * `Headers` class with conveniences the native API lacks: non-string values,
 * bulk assignment through {@link Headers.setMany}, and structured builders for
 * `Cache-Control` and `Content-Disposition`.
 *
 * The patch is what lets {@link Res}, {@link FileRoute} and {@link BundleRoute}
 * write headers without stringifying every value by hand. It applies to the
 * process's own `Headers`, so it must be installed once at startup, before any
 * request is served.
 *
 * @module Headers
 */

import type { MaybeArray, Nullable, Optional, OrString } from "@/utils/is";
import type { ValueOf } from "@/utils/object";

/**
 * A value accepted by the patched header setters. Numbers and booleans are
 * stringified on the way in, so a byte length or a flag can be passed as-is.
 */
type HeadersInitValue = string | number | boolean;

/**
 * What {@link Headers.setMany} accepts: entry pairs, a plain object, or another
 * `Headers` instance.
 */
type CustomHeadersInit = [string, HeadersInitValue][] | Record<string, HeadersInitValue> | Headers;

/** Just some common headers. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) for the full spec. */
const HeaderKey = {
	/** Controls caching mechanisms for requests and responses. */
	CacheControl: "Cache-Control",
	/** Specifies the media type of the resource or data. */
	ContentType: "Content-Type",
	/** Indicates the size of the entity-body in bytes. */
	ContentLength: "Content-Length",
	/** Whether to display payload inline within the page or prompt the user to download it as an attachment. */
	ContentDisposition: "Content-Disposition",
	/** Specifies the character encodings that are acceptable. */
	AcceptEncoding: "Accept-Encoding",
	/** Informs the server about the types of data that can be sent back. */
	Accept: "Accept",
	/** Contains the credentials to authenticate with the server. */
	Authorization: "Authorization",
	/** The user agent string of the client software. */
	UserAgent: "User-Agent",
	/** The domain name of the server and port number. */
	Host: "Host",
	/** The address of the previous web page from which the current request originated. */
	Referer: "Referer",
	/** Indicates whether the connection should be kept alive. */
	Connection: "Connection",
	/** Requests that the server switch to a different protocol (e.g. WebSocket). */
	Upgrade: "Upgrade",
	/** Used to specify directives that must be obeyed by caching mechanisms. */
	Pragma: "Pragma",
	/** The date and time at which the message was sent. */
	Date: "Date",
	/** Makes the request conditional based on the ETag of the resource. */
	IfNoneMatch: "If-None-Match",
	/** Makes the request conditional based on the last modification date. */
	IfModifiedSince: "If-Modified-Since",
	/** An identifier for a specific version of a resource. */
	ETag: "ETag",
	/** The date and time after which the response is considered stale. */
	Expires: "Expires",
	/** The last modification date of the resource. */
	LastModified: "Last-Modified",
	/** Indicates the URL to redirect a page to. */
	Location: "Location",
	/** Defines the authentication method that should be used. */
	WWWAuthenticate: "WWW-Authenticate",
	/** Determines how long the results of a preflight request can be cached. */
	AccessControlMaxAge: "Access-Control-Max-Age",
	/** Indicates whether the response can be shared with resources with credentials. */
	AccessControlAllowCredentials: "Access-Control-Allow-Credentials",
	/** Indicates which HTTP method will be used in the actual CORS request. */
	AccessControlRequestMethod: "Access-Control-Request-Method",
	/** Indicates which headers can be exposed to the browser in a CORS response. */
	AccessControlExposeHeaders: "Access-Control-Expose-Headers",
	/** Indicates which origins are allowed to access the resource. */
	AccessControlAllowOrigin: "Access-Control-Allow-Origin",
	/** Specifies the HTTP methods allowed when accessing the resource in a CORS request. */
	AccessControlAllowMethods: "Access-Control-Allow-Methods",
	/** Specifies the HTTP headers allowed in a CORS request. */
	AccessControlAllowHeaders: "Access-Control-Allow-Headers",
	/** Sends cookies from the server to the client. */
	SetCookie: "Set-Cookie",
	/** Sends cookies from the client to the server. */
	Cookie: "Cookie",
	/** Determines which headers should be used to select a response from cache when content negotiation is in use. */
	Vary: "Vary",
	/** Set to "nosniff" by default in {@link Res}. */
	XContentTypeOptions: "X-Content-Type-Options",
} as const;

/**
 * A header name. The {@link HeaderKey} constants are suggested, but
 * {@link OrString} keeps any custom header name assignable — the enum is a
 * convenience, not a restriction.
 */
type HeaderKey = OrString<ValueOf<typeof HeaderKey>>;

/**
 * A caching policy, rendered into a `Cache-Control` value by
 * {@link createCacheControlHeader}. Used by {@link FileRoute.cache} and by each
 * entry of a {@link BundleRouteDefinition}.
 */
interface CacheControlDefinition {
	/** Allows shared caches — proxies and CDNs — to store the response, not just the browser. */
	public?: boolean;
	/** How long the response stays fresh, in seconds. */
	maxAge?: number;
	/** Promises the response will never change, so the browser skips revalidation entirely. Only meaningful with a content hash in the URL. */
	immutable?: boolean;
	/** Caches the response but revalidates before every use. Overrides the other directives except `noStore`. */
	noCache?: boolean;
	/** Forbids storing the response anywhere. Overrides every other directive. */
	noStore?: boolean;
}

/**
 * Renders a {@link CacheControlDefinition} into a `Cache-Control` header value.
 *
 * The two prohibitive directives take precedence and are emitted alone, since
 * combining them with freshness directives is contradictory: `noStore` wins over
 * everything, then `noCache`. Otherwise the remaining directives are joined in
 * order.
 *
 * @param def - The caching policy to render.
 * @returns The header value, or an empty string when the definition sets
 * nothing.
 */
function createCacheControlHeader(def: CacheControlDefinition): string {
	if (def.noStore) return "no-store";
	if (def.noCache) return "no-cache";

	const parts: string[] = [];

	if (def.public) parts.push("public");
	if (def.maxAge !== undefined) parts.push(`max-age=${def.maxAge}`);
	if (def.immutable) parts.push("immutable");

	return parts.join(", ");
}

/**
 * How a response body should be presented, rendered by
 * {@link createContentDispositionHeader}.
 */
interface ContentDispositionDefinition {
	/** `"inline"` to display in the browser, `"attachment"` to prompt a download. */
	disposition: "attachment" | "inline";
	/** The name to save the file under. Omit it to let the client decide. */
	filename?: string;
}

/**
 * Renders a {@link ContentDispositionDefinition} into a `Content-Disposition`
 * header value.
 *
 * @param def - The disposition to render.
 * @returns The header value, with a quoted `filename` parameter when one is
 * given.
 */
function createContentDispositionHeader(def: ContentDispositionDefinition) {
	if (def.filename === undefined) return def.disposition;
	return `${def.disposition}; filename="${def.filename}"`;
}

/**
 * Reads a header from any `HeadersInit` shape, without constructing a `Headers`.
 *
 * Header names are case-insensitive, so every shape is matched case-insensitively:
 * a `Headers` instance is probed with both casings, and the array and object
 * forms are scanned with lowercased comparison.
 *
 * @param headers - The headers to read, in any accepted form. `undefined` and
 * `null` are allowed and yield `null`.
 * @param name - The header to look for.
 * @returns The value, or `null` when absent.
 */
function readHeader(headers: Optional<HeadersInit>, name: HeaderKey): Nullable<string> {
	if (!headers) return null;
	if (headers instanceof Headers) {
		return headers.get(name) ?? headers.get(name.toLowerCase());
	}

	const lower = name.toLowerCase();
	if (Array.isArray(headers)) {
		for (const [key, value] of headers) {
			if (key.toLowerCase() === lower) return value;
		}
		return null;
	}

	// plain Record<string, string>
	for (const key in headers) {
		if (key.toLowerCase() === lower) return headers[key] ?? null;
	}
	return null;
}

/**
 * Installs the extended `Headers` behaviour declared above onto the global
 * class. Call it once at startup, before any request is served.
 *
 * The patch is applied twice over, deliberately. The prototype methods are
 * replaced so headers *the runtime* created — those on an incoming `Request`, or
 * on a `Response` built elsewhere — gain the same behaviour. The global class is
 * then also replaced with a subclass, so instances constructed after the patch
 * carry the methods as own class members rather than only as prototype
 * assignments.
 *
 * The subclass overrides `Symbol.hasInstance` to defer to the native class, so
 * `instanceof Headers` stays true for objects the runtime created before or
 * outside the patch. Without it, the swap would silently break every
 * `instanceof` check against headers the framework did not construct.
 */
function patchGlobalHeaders() {
	const NativeHeaders = globalThis.Headers;

	const setNative = NativeHeaders.prototype.set;
	const getNative = NativeHeaders.prototype.get;
	const appendNative = Headers.prototype.append;
	const hasNative = Headers.prototype.has;

	/**
	 * Converts a header value to its string form.
	 *
	 * @param value - The value to stringify.
	 * @returns The string, with booleans rendered by {@link boolString}.
	 */
	function strHeaderValue(value: HeadersInitValue): string {
		if (typeof value === "string") return value;
		else if (typeof value === "number") return value.toString();
		else return String(value);
	}

	/**
	 * Case-tolerant `has`, falling back to the lowercased name.
	 *
	 * @param name - The header to check.
	 * @returns `true` when present under either casing.
	 */
	function hasHeader(this: Headers, name: HeaderKey): boolean {
		return hasNative.call(this, name) ?? hasNative.call(this, name.toLowerCase());
	}

	/**
	 * Case-tolerant `get`, falling back to the lowercased name.
	 *
	 * @param name - The header to read.
	 * @returns The value, or `null` when absent under both casings.
	 */
	function getHeader(this: Headers, name: HeaderKey): Nullable<string> {
		return getNative.call(this, name) ?? getNative.call(this, name.toLowerCase());
	}

	/**
	 * `set` that accepts numbers and booleans as well as strings.
	 *
	 * @param name - The header to set.
	 * @param value - The value, stringified by {@link strHeaderValue}.
	 */
	function setHeader(this: Headers, name: HeaderKey, value: HeadersInitValue): void {
		setNative.call(this, name, strHeaderValue(value));
	}

	/**
	 * `append` that accepts non-string values and arrays.
	 *
	 * An array appends each item as its own header line, which is what
	 * multi-valued headers such as `Set-Cookie` require — a joined string would be
	 * one header, not several.
	 *
	 * @param name - The header to append to.
	 * @param value - A value or an array of values.
	 */
	function appendHeader(this: Headers, name: HeaderKey, value: MaybeArray<HeadersInitValue>) {
		if (Array.isArray(value)) {
			for (const v of value) {
				appendNative.call(this, name, strHeaderValue(v));
			}
		} else {
			appendNative.call(this, name, strHeaderValue(value));
		}
	}

	/**
	 * Sets many headers in one call.
	 *
	 * Copying from another `Headers` appends `Set-Cookie` rather than setting it,
	 * so multiple cookies survive the copy instead of collapsing into one. The
	 * array and object forms skip empty and whitespace-only values, so an unset
	 * optional header is simply not written — which is why the file-serving routes
	 * can pass a blank cache header without emitting one.
	 *
	 * @param init - The headers to copy in. See {@link CustomHeadersInit}.
	 */
	function setManyHeaders(this: Headers, init: CustomHeadersInit) {
		if (init instanceof Headers) {
			init.forEach((value, key) => {
				if (key.toLowerCase() === HeaderKey.SetCookie.toLowerCase()) this.append(key, value);
				else this.set(key, value);
			});
		} else {
			const entries = Array.isArray(init) ? init : Object.entries(init);
			for (const [key, val] of entries) {
				const value = strHeaderValue(val);
				if (!value || !value.trim()) continue;
				this.set(key, value);
			}
		}
	}

	/**
	 * Sets `Cache-Control` from a structured definition.
	 *
	 * @param def - The {@link CacheControlDefinition} to render with
	 * {@link createCacheControlHeader}.
	 */
	function setCacheControl(this: Headers, def: CacheControlDefinition): void {
		this.set(HeaderKey.CacheControl, createCacheControlHeader(def));
	}

	/**
	 * Sets `Content-Disposition` from a structured definition.
	 *
	 * @param def - The {@link ContentDispositionDefinition} to render with
	 * {@link createContentDispositionHeader}.
	 */
	function setContentDisposition(this: Headers, def: ContentDispositionDefinition): void {
		this.set(HeaderKey.ContentDisposition, createContentDispositionHeader(def));
	}

	Headers.prototype.get = getHeader;
	Headers.prototype.set = setHeader;
	Headers.prototype.append = appendHeader;
	Headers.prototype.setMany = setManyHeaders;
	Headers.prototype.setCacheControl = setCacheControl;
	Headers.prototype.setContentDisposition = setContentDisposition;

	globalThis.Headers = class extends NativeHeaders {
		/**
		 * Defers `instanceof` to the native class, so headers created by the runtime
		 * — before this patch, or outside it — still satisfy `instanceof Headers`.
		 *
		 * @param value - The value being tested.
		 * @returns `true` when it is a native `Headers`.
		 */
		static override [Symbol.hasInstance](value: unknown): boolean {
			return value instanceof NativeHeaders;
		}

		/**
		 * Reports whether a header is present, falling back to the lowercased name.
		 *
		 * @param name - The header to check.
		 * @returns `true` when present.
		 */
		override has(name: HeaderKey): boolean {
			return hasHeader.call(this, name);
		}

		/**
		 * Reads a header, falling back to the lowercased name.
		 *
		 * @param name - The header to read.
		 * @returns The value, or `null` when absent.
		 */
		override get(name: HeaderKey): Nullable<string> {
			return getHeader.call(this, name);
		}

		/**
		 * Sets a header, replacing any existing value.
		 *
		 * @param name - The header to set.
		 * @param value - The value; numbers and booleans are stringified.
		 */
		override set(name: HeaderKey, value: HeadersInitValue): void {
			setHeader.call(this, name, value);
		}

		/**
		 * Adds a header value without replacing existing ones.
		 *
		 * @param name - The header to append to.
		 * @param value - A value, or an array appended as separate header lines.
		 */
		override append(name: HeaderKey, value: MaybeArray<HeadersInitValue>): void {
			appendHeader.call(this, name, value);
		}

		/**
		 * Sets many headers in one call.
		 *
		 * @param init - The headers to copy in. See {@link CustomHeadersInit}.
		 */
		override setMany(init: CustomHeadersInit): void {
			setManyHeaders.call(this, init);
		}

		/**
		 * Sets `Cache-Control` from a structured definition.
		 *
		 * @param def - The {@link CacheControlDefinition} to render.
		 */
		override setCacheControl(def: CacheControlDefinition): void {
			setCacheControl.call(this, def);
		}

		/**
		 * Sets `Content-Disposition` from a structured definition.
		 *
		 * @param def - The {@link ContentDispositionDefinition} to render.
		 */
		override setContentDisposition(def: ContentDispositionDefinition): void {
			setContentDisposition.call(this, def);
		}
	};
}

declare global {
	/**
	 * The `Headers` surface after {@link patchGlobalHeaders} has run.
	 *
	 * The existing methods are re-declared to accept a {@link HeaderKey} and a
	 * {@link HeadersInitValue}; the rest are additions.
	 */
	interface Headers {
		/** Adds a value without replacing existing ones. An array appends each item as its own header line. */
		append(name: HeaderKey, value: MaybeArray<HeadersInitValue>): void;
		/** Sets a header, replacing any existing value. Numbers and booleans are stringified. */
		set(name: HeaderKey, value: HeadersInitValue): void;
		/** Reads a header, falling back to the lowercased name. */
		get(name: HeaderKey): Nullable<string>;
		/** Reports whether a header is present, falling back to the lowercased name. */
		has(name: HeaderKey): boolean;
		/** Sets many headers at once. See {@link CustomHeadersInit}. */
		setMany(init: CustomHeadersInit): void;
		/** Sets `Cache-Control` from a {@link CacheControlDefinition}. */
		setCacheControl(def: CacheControlDefinition): void;
		/** Sets `Content-Disposition` from a {@link ContentDispositionDefinition}. */
		setContentDisposition(def: ContentDispositionDefinition): void;
	}
}

export {
	patchGlobalHeaders,
	createCacheControlHeader,
	createContentDispositionHeader,
	readHeader,
	HeaderKey,
	type ContentDispositionDefinition,
	type CacheControlDefinition,
};

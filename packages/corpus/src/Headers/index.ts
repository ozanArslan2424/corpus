import { boolString } from "@/utils/boolean";
import { enumerate, type ValueOf } from "@/utils/enum";
import { isString, type OrString } from "@/utils/lexical";
import type { MaybeArray, Nullable, Optional } from "@/utils/maybe";
import { isNumber } from "@/utils/numerical";

type HeadersInitValue = string | number | boolean;
type CustomHeadersInit = [string, HeadersInitValue][] | Record<string, HeadersInitValue> | Headers;

declare global {
	interface Headers {
		append(name: HeaderKey, value: MaybeArray<HeadersInitValue>): void;
		set(name: HeaderKey, value: HeadersInitValue): void;
		get(name: HeaderKey): Nullable<string>;
		has(name: HeaderKey): boolean;
		delete(name: HeaderKey): void;
		setMany(init: CustomHeadersInit): void;
		setCacheControl(def: CacheControlDefinition): void;
		setContentDisposition(def: ContentDispositionDefinition): void;
	}
}

/** Just some common headers. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) for the full spec. */
const HeaderKey = enumerate({
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
});

type HeaderKey = OrString<ValueOf<typeof HeaderKey>>;

interface CacheControlDefinition {
	public?: boolean;
	maxAge?: number;
	immutable?: boolean;
	noCache?: boolean;
	noStore?: boolean;
}

function createCacheControlHeader(def: CacheControlDefinition): string {
	if (def.noStore) return "no-store";
	if (def.noCache) return "no-cache";

	const parts: string[] = [];

	if (def.public) parts.push("public");
	if (def.maxAge !== undefined) parts.push(`max-age=${def.maxAge}`);
	if (def.immutable) parts.push("immutable");

	return parts.join(", ");
}

interface ContentDispositionDefinition {
	disposition: "attachment" | "inline";
	filename?: string;
}

function createContentDispositionHeader(def: ContentDispositionDefinition) {
	if (def.filename === undefined) return def.disposition;
	return `${def.disposition}; filename="${def.filename}"`;
}

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

function patchGlobalHeaders() {
	const NativeHeaders = globalThis.Headers;

	const setNative = NativeHeaders.prototype.set;
	const getNative = NativeHeaders.prototype.get;
	const appendNative = Headers.prototype.append;
	const hasNative = Headers.prototype.has;

	function strHeaderValue(value: HeadersInitValue): string {
		if (isString(value)) return value;
		else if (isNumber(value)) return value.toString();
		else return boolString(value);
	}

	function hasHeader(this: Headers, name: HeaderKey): boolean {
		return hasNative.call(this, name) ?? hasNative.call(this, name.toLowerCase());
	}

	function getHeader(this: Headers, name: HeaderKey): Nullable<string> {
		return getNative.call(this, name) ?? getNative.call(this, name.toLowerCase());
	}

	function setHeader(this: Headers, name: HeaderKey, value: HeadersInitValue): void {
		setNative.call(this, name, strHeaderValue(value));
	}

	function appendHeader(this: Headers, name: HeaderKey, value: MaybeArray<HeadersInitValue>) {
		if (Array.isArray(value)) {
			for (const v of value) {
				appendNative.call(this, name, strHeaderValue(v));
			}
		} else {
			appendNative.call(this, name, strHeaderValue(value));
		}
	}

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

	function setCacheControl(this: Headers, def: CacheControlDefinition): void {
		this.set(HeaderKey.CacheControl, createCacheControlHeader(def));
	}

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
		static override [Symbol.hasInstance](value: unknown): boolean {
			return value instanceof NativeHeaders;
		}

		override has(name: HeaderKey): boolean {
			return hasHeader.call(this, name);
		}

		override get(name: HeaderKey): Nullable<string> {
			return getHeader.call(this, name);
		}

		override set(name: HeaderKey, value: HeadersInitValue): void {
			setHeader.call(this, name, value);
		}

		override append(name: HeaderKey, value: MaybeArray<HeadersInitValue>): void {
			appendHeader.call(this, name, value);
		}

		override setMany(init: CustomHeadersInit): void {
			setManyHeaders.call(this, init);
		}

		override setCacheControl(def: CacheControlDefinition): void {
			setCacheControl.call(this, def);
		}

		override setContentDisposition(def: ContentDispositionDefinition): void {
			setContentDisposition.call(this, def);
		}
	};
}

export type { ContentDispositionDefinition, CacheControlDefinition };
export {
	HeaderKey,
	createCacheControlHeader,
	createContentDispositionHeader,
	readHeader,
	patchGlobalHeaders,
};

/**
 * Response building: status codes, body serialization, streaming, and cookies.
 *
 * A {@link Res} is what a handler shapes on its way to a native `Response`. It
 * is created lazily on {@link Context.res}, so a handler that just returns a
 * value never constructs one; reach for it when the response needs a status,
 * headers, cookies, or a body form that a plain return value cannot express —
 * a file, a redirect, or a stream.
 *
 * Body serialization is inferred from the value's type at
 * {@link Res.toNativeResponse} time, so an object becomes JSON, a typed array
 * stays binary, and a stream passes through untouched — each with a matching
 * `Content-Type` unless one was set explicitly.
 *
 * ```ts
 * import { Res, Status } from "@ozanarslan/corpus";
 *
 * new Res({ id: 1 }, { status: Status.CREATED });
 * new Res().file("./report.pdf");
 * new Res().redirect("/login");
 * ```
 *
 * @module Res
 */

import { Cookies } from "@/Cookies";
import { Exception } from "@/Exception";
import {
	createContentDispositionHeader,
	HeaderKey,
	type ContentDispositionDefinition,
} from "@/Headers";
import {
	type MaybePromise,
	type Nullable,
	type Optional,
	isPresent,
	isAbsent,
	isPrimitive,
} from "@/utils/is";
import { lazy, type Lazy, type LazyMut } from "@/utils/lazy";
import type { ValueOf } from "@/utils/object";
import { type Tuple, tuple } from "@/utils/tuple";
import { XFile } from "@/XFile";

/** Commonly used HTTP status codes. */
const Status = {
	/** Continue: Request received, please continue */
	CONTINUE: 100,
	/** Switching Protocols: Protocol change request approved */
	SWITCHING_PROTOCOLS: 101,
	/** Processing (WebDAV) */
	PROCESSING: 102,
	/** Early Hints */
	EARLY_HINTS: 103,
	/** OK: Request succeeded */
	OK: 200,
	/** Created: Resource created */
	CREATED: 201,
	/** Accepted: Request accepted but not completed */
	ACCEPTED: 202,
	/** Non-Authoritative Information */
	NON_AUTHORITATIVE_INFORMATION: 203,
	/** No Content: Request succeeded, no body returned */
	NO_CONTENT: 204,
	/** Reset Content: Clear form or view */
	RESET_CONTENT: 205,
	/** Partial Content: Partial GET successful (e.g. range requests) */
	PARTIAL_CONTENT: 206,
	/** Multi-Status (WebDAV) */
	MULTI_STATUS: 207,
	/** Already Reported (WebDAV) */
	ALREADY_REPORTED: 208,
	/** IM Used (HTTP Delta encoding) */
	IM_USED: 226,
	/** Multiple Choices */
	MULTIPLE_CHOICES: 300,
	/** Moved Permanently: Resource moved to a new URL */
	MOVED_PERMANENTLY: 301,
	/** Found: Resource temporarily under different URI */
	FOUND: 302,
	/** See Other: Redirect to another URI using GET */
	SEE_OTHER: 303,
	/** Not Modified: Cached version is still valid */
	NOT_MODIFIED: 304,
	/** Use Proxy: Deprecated */
	USE_PROXY: 305,
	/** Temporary Redirect: Resource temporarily at another URI */
	TEMPORARY_REDIRECT: 307,
	/** Permanent Redirect: Resource permanently at another URI */
	PERMANENT_REDIRECT: 308,
	/** Bad Request: Malformed request */
	BAD_REQUEST: 400,
	/** Unauthorized: Missing or invalid auth credentials */
	UNAUTHORIZED: 401,
	/** Payment Required: Reserved for future use */
	PAYMENT_REQUIRED: 402,
	/** Forbidden: Authenticated but no permission */
	FORBIDDEN: 403,
	/** Not Found: Resource does not exist */
	NOT_FOUND: 404,
	/** Method Not Allowed: HTTP method not allowed */
	METHOD_NOT_ALLOWED: 405,
	/** Not Acceptable: Response not acceptable by client */
	NOT_ACCEPTABLE: 406,
	/** Proxy Authentication Required */
	PROXY_AUTHENTICATION_REQUIRED: 407,
	/** Request Timeout: Server timeout waiting for client */
	REQUEST_TIMEOUT: 408,
	/** Conflict: Request conflict (e.g. duplicate resource) */
	CONFLICT: 409,
	/** Gone: Resource is no longer available */
	GONE: 410,
	/** Length Required: Missing Content-Length header */
	LENGTH_REQUIRED: 411,
	/** Precondition Failed */
	PRECONDITION_FAILED: 412,
	/** Payload Too Large */
	PAYLOAD_TOO_LARGE: 413,
	/** URI Too Long */
	URI_TOO_LONG: 414,
	/** Unsupported Media Type */
	UNSUPPORTED_MEDIA_TYPE: 415,
	/** Range Not Satisfiable */
	RANGE_NOT_SATISFIABLE: 416,
	/** Expectation Failed */
	EXPECTATION_FAILED: 417,
	/** I'm a teapot: Joke response for coffee machines */
	IM_A_TEAPOT: 418,
	/** Misdirected Request: Sent to the wrong server */
	MISDIRECTED_REQUEST: 421,
	/** Unprocessable Entity (WebDAV) */
	UNPROCESSABLE_ENTITY: 422,
	/** Locked (WebDAV) */
	LOCKED: 423,
	/** Failed Dependency (WebDAV) */
	FAILED_DEPENDENCY: 424,
	/** Too Early: Request might be replayed */
	TOO_EARLY: 425,
	/** Upgrade Required */
	UPGRADE_REQUIRED: 426,
	/** Precondition Required */
	PRECONDITION_REQUIRED: 428,
	/** Too Many Requests: Rate limiting */
	TOO_MANY_REQUESTS: 429,
	/** Request Header Fields Too Large */
	REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
	/** Unavailable For Legal Reasons */
	UNAVAILABLE_FOR_LEGAL_REASONS: 451,
	/** Internal Server Error: Unhandled server error */
	INTERNAL_SERVER_ERROR: 500,
	/** Not Implemented: Endpoint/method not implemented */
	NOT_IMPLEMENTED: 501,
	/** Bad Gateway: Invalid response from upstream server */
	BAD_GATEWAY: 502,
	/** Service Unavailable: Server temporarily overloaded/down */
	SERVICE_UNAVAILABLE: 503,
	/** Gateway Timeout: No response from upstream server */
	GATEWAY_TIMEOUT: 504,
	/** HTTP Version Not Supported */
	HTTP_VERSION_NOT_SUPPORTED: 505,
	/** Variant Also Negotiates */
	VARIANT_ALSO_NEGOTIATES: 506,
	/** Insufficient Storage (WebDAV) */
	INSUFFICIENT_STORAGE: 507,
	/** Loop Detected (WebDAV) */
	LOOP_DETECTED: 508,
	/** Not Extended */
	NOT_EXTENDED: 510,
	/** Network Authentication Required */
	NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

/**
 * An HTTP status code. The {@link Status} constants are suggested, but any
 * number is assignable.
 */
type Status = ValueOf<typeof Status> | (number & {});

/**
 * Converts a body value into something `Response` accepts, and infers the
 * content type that goes with it.
 *
 * Types are checked in a deliberate order. Binary views are matched before the
 * JSON catch-all, because `Buffer` defines its own `toJSON` and would otherwise
 * serialize to `{"type":"Buffer","data":[…]}` instead of being sent as bytes.
 * Streams get no inferred type at all — the producer knows what it is streaming,
 * so {@link FileRoute} and {@link StaticRoute} set it themselves.
 *
 * @param b - The value to send as the body.
 * @returns A {@link Tuple} of the `BodyInit` and the inferred content type,
 * either of which may be `null`.
 */
function resolveResBody(b: unknown): Tuple<Nullable<BodyInit>, Nullable<string>> {
	if (isAbsent(b)) return tuple(null, null);

	if (isPrimitive(b)) return tuple(String(b), "text/plain");

	// Any typed array or DataView (Uint8Array, Int32Array, Float64Array, DataView,
	// Node's Buffer, etc.) is raw binary and must be forwarded as-is - NOT
	// JSON.stringify'd. This check must stay ahead of the catch-all at the bottom.
	// QUIRK: fs.readFileSync/Bun's byte-reading APIs return Uint8Array<ArrayBufferLike>,
	// while lib.dom.d.ts's BodyInit/ArrayBufferView are pinned to Uint8Array<ArrayBuffer>
	// in newer TS versions - hence the cast. This is a type-checker-only mismatch;
	// both are the same thing at runtime and Bun/fetch accept it fine.
	if (ArrayBuffer.isView(b)) return tuple(b as BodyInit, "application/octet-stream");

	if (typeof b !== "object") return tuple(String(b), null);

	// The raw backing buffer itself (not a view over it) is also valid BodyInit.
	if (b instanceof ArrayBuffer) return tuple(b, "application/octet-stream");

	// Blobs store type
	if (b instanceof Blob) return tuple(b, b.type || null);

	if (b instanceof FormData) return tuple(b, "multipart/form-data");

	if (b instanceof URLSearchParams) return tuple(b, "application/x-www-form-urlencoded");

	// No content-type is inferred for streams - the producer (e.g. StaticRoute,
	// FileRoute) is expected to set Content-Type explicitly before returning one.
	if (b instanceof ReadableStream) return tuple(b, null);

	// This is a deliberate convenience conversion, not a passthrough.
	// Serialized to an ISO string, same as any other object below.
	if (b instanceof Date) return tuple(b.toISOString(), "text/plain");

	// Catch-all: plain objects/arrays/other class instances get JSON-stringified.
	// IMPORTANT: this used to silently swallow Buffer/Uint8Array too, since Buffer's
	// own toJSON() serializes to {"type":"Buffer","data":[...]}. The ArrayBuffer.isView
	// check above must always run before this line, or that regression comes back.
	return tuple(JSON.stringify(b), "application/json");
}

/**
 * Produces the events for a server-sent event stream, used by {@link Res.sse}.
 *
 * @param send - Emits one event. `data` is JSON-serialized; `event` names the
 * event type for a client listening on something other than `message`, and `id`
 * lets a client resume from where it left off.
 * @returns Nothing when the source is finite — the stream is closed for you once
 * it resolves — or a cleanup function when it is open-ended, in which case the
 * stream stays open and the function runs if the client disconnects.
 */
type SseSource = (
	send: (item: { data: unknown; event?: string; id?: string }) => void,
) => MaybePromise<void | (() => void)>;

/**
 * Produces the lines for a newline-delimited JSON stream, used by
 * {@link Res.ndjson}.
 *
 * @param send - Emits one item, JSON-serialized on its own line.
 * @returns Nothing to close the stream when the source resolves, or a cleanup
 * function to keep it open and be told when the client disconnects.
 */
type NdjsonSource = (send: (item: unknown) => void) => MaybePromise<void | (() => void)>;

/**
 * Wraps a producer function into a `ReadableStream` with disconnect handling.
 *
 * Whether the stream closes on its own is decided by what the producer returns:
 * no cleanup function means it had a finite amount to send, so the stream closes
 * when it resolves; a cleanup function means it is open-ended and the stream
 * stays open until the client goes away.
 *
 * The cancelled flag is passed in rather than checked here, because a producer
 * that is mid-loop needs to notice the disconnect itself — sending after
 * cancellation would throw on a closed controller.
 *
 * @param execute - Fills the stream. Receives the controller to enqueue through,
 * and a predicate reporting whether the client has disconnected.
 * @returns The stream. Anything the producer throws surfaces as a stream error.
 */
function createStream(
	execute: (
		controller: ReadableStreamDefaultController,
		isCancelled: () => boolean,
	) => MaybePromise<(() => void) | void>,
): ReadableStream {
	let cancelled = false;
	let cleanupPromise: Optional<Promise<(() => void) | void>>;
	return new ReadableStream({
		start(controller) {
			cleanupPromise = (async () => {
				try {
					const cleanup = await execute(controller, () => cancelled);
					if (typeof cleanup !== "function") controller.close();
					return cleanup;
				} catch (err) {
					controller.error(err);
				}
			})();
		},
		async cancel() {
			cancelled = true;
			const cleanup = await cleanupPromise;
			cleanup?.();
		},
	});
}

/**
 * Resolves a path or file into a readable {@link XFile}.
 *
 * @param fileOrPath - An {@link XFile} or a path to one.
 * @returns The file.
 * @throws {@link Exception} with {@link Status.NOT_FOUND} when it does not
 * exist, carrying the path as exception data.
 */
function resolveFile(fileOrPath: XFile | string): XFile {
	const file = fileOrPath instanceof XFile ? fileOrPath : new XFile(fileOrPath);
	if (!file.exists()) {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND, { filePath: file.path });
	}
	return file;
}

/**
 * Wraps a response's headers so that writing `Set-Cookie` also updates the
 * cookie map.
 *
 * {@link Res} exposes cookies two ways — as headers and as a {@link Cookies} map
 * — and they must not disagree. The map wins at serialization time, so a
 * `Set-Cookie` written directly as a header would be dropped unless it is
 * mirrored into the map, which is what this does. An array append is mirrored
 * item by item, since each is its own cookie.
 *
 * @param headers - The headers to wrap. Mutated in place.
 * @param getCookies - Resolves the cookie map lazily, so wrapping does not force
 * it into existence.
 * @returns The same headers object.
 */
function resHeadersWrapper(headers: Headers, getCookies: () => Cookies): Headers {
	const set = headers.set.bind(headers);
	const append = headers.append.bind(headers);

	function sync(cookieString: string) {
		getCookies().set(Bun.Cookie.parse(cookieString));
	}

	headers.set = ((...args: Parameters<Headers["set"]>) => {
		set(...args);
		if (args[0].toLowerCase() === HeaderKey.SetCookie.toLowerCase()) {
			sync(String(args[1]));
		}
	}) as Headers["set"];

	headers.append = ((...args: Parameters<Headers["append"]>) => {
		append(...args);
		if (args[0].toLowerCase() === HeaderKey.SetCookie.toLowerCase()) {
			if (Array.isArray(args[1])) {
				for (const cs of args[1]) sync(String(cs));
			} else {
				sync(String(args[1]));
			}
		}
	}) as Headers["append"];

	return headers;
}

/** A `ResponseInit` that can also carry cookies. */
interface ResInit extends ResponseInit {
	/** Cookies to seed {@link Res.cookies} with. */
	cookies?: Cookies;
}

/**
 * A response under construction.
 *
 * Everything is mutable until {@link Res.toNativeResponse} is called, so a
 * {@link Middleware} can adjust a response a route handler already built. The
 * body is kept as the original value rather than serialized eagerly, which is
 * what lets the content type be inferred from it at the very end.
 *
 * Headers and cookies are both lazy, so an untouched response allocates neither.
 * The chainable methods — {@link Res.file}, {@link Res.redirect},
 * {@link Res.sse} and the rest — set the body and its headers together and
 * return `this`.
 *
 * @typeParam R - The body type, carried from the route's own response type.
 */
class Res<R = unknown> {
	/**
	 * Creates a response.
	 *
	 * @param body - The body value. Serialized by {@link resolveResBody} at
	 * {@link Res.toNativeResponse} time, not now.
	 * @param init - Status, status text, headers and cookies. See
	 * {@link ResInit}.
	 */
	constructor(body?: Nullable<BodyInit | R>, init?: ResInit) {
		this.body = isAbsent(body) ? null : body;

		this.status = init?.status ?? Status.OK;

		this.statusText = init?.statusText ?? "";

		this._cookies = lazy(() => init?.cookies ?? new Cookies());

		this._headers = lazy.synced({
			init: () =>
				resHeadersWrapper(
					init?.headers instanceof Headers ? init.headers : new Headers(init?.headers),
					() => this._cookies(),
				),
			onGet: (value) => {
				const cookies = this._cookies();
				// Cookie values are percent-encoded on serialize - that is what keeps
				// a CRLF in a value from splitting the response. The encoding must
				// happen exactly once: see the double-encoding tests in Res.
				// Use the prototype methods, not the patched ones: writing the
				// map into the header must not feed the header back into the
				// map. Bun.Cookie.parse does not decode what serialize encoded,
				// so each round-trip re-encodes ("%3A" -> "%253A").
				Headers.prototype.delete.call(value, HeaderKey.SetCookie);
				for (const header of cookies.toSetCookieHeaders()) {
					Headers.prototype.append.call(value, HeaderKey.SetCookie, header);
				}
				return value;
			},
		});
	}

	/**
	 * The body to send. Assign any value — objects become JSON, typed arrays stay
	 * binary, streams pass through — and {@link resolveResBody} works out the rest
	 * at serialization time.
	 */
	body: Nullable<BodyInit | R> = null;

	/** The status code. Defaults to {@link Status.OK}. */
	status: number;

	/** The status text. Empty by default, which lets the runtime supply the standard phrase. */
	statusText: string;

	/** Backing store for {@link Res.headers}, created on first access. */
	private _headers: LazyMut<Headers>;

	/**
	 * The response headers.
	 *
	 * Reading them rewrites the `Set-Cookie` lines from {@link Res.cookies} first,
	 * so the two views never disagree — and writing `Set-Cookie` here feeds back
	 * into the cookie map. Values may be numbers or booleans, since
	 * {@link patchGlobalHeaders} has stringified setters.
	 *
	 * @returns The headers, created on first access.
	 */
	get headers(): Headers {
		return this._headers();
	}

	/** Backing store for {@link Res.cookies}, created on first access. */
	private _cookies: Lazy<Cookies>;

	/**
	 * The cookies to send, as a mutable map.
	 *
	 * This is the authoritative view: the map is serialized into `Set-Cookie`
	 * whenever {@link Res.headers} is read, so deleting a cookie here removes its
	 * header. Values are percent-encoded on serialization, which is what keeps a
	 * CRLF in a cookie value from splitting the response.
	 *
	 * @returns The {@link Cookies} map, created on first access.
	 */
	get cookies(): Cookies {
		return this._cookies();
	}

	/**
	 * Serializes everything into a native `Response`.
	 *
	 * The content type inferred from the body is applied only when none was set
	 * explicitly, so a handler's own choice always wins. `X-Content-Type-Options:
	 * nosniff` is set unconditionally — without it a browser will sniff a
	 * `text/plain` body that looks like markup and render it as HTML, turning any
	 * reflected value into XSS.
	 *
	 * @returns The response to send over the wire. Called by
	 * {@link App.respond}.
	 */
	toNativeResponse(): Response {
		const data = this.body;
		const headers = this.headers;
		const status = this.status;
		const statusText = this.statusText;
		const [body, contentType] = resolveResBody(data);
		if (isPresent(contentType) && !headers.has(HeaderKey.ContentType)) {
			headers.set(HeaderKey.ContentType, contentType);
		}
		// Browsers will otherwise MIME-sniff a text/plain body that looks like
		// markup and render it as HTML, turning any reflected value into XSS.
		// Set unconditionally: there is no case where sniffing is wanted.
		if (!headers.has(HeaderKey.XContentTypeOptions)) {
			headers.set(HeaderKey.XContentTypeOptions, "nosniff");
		}
		return new Response(body, { headers, status, statusText });
	}

	/**
	 * Turns the response into a server-sent event stream.
	 *
	 * Sets the body to a stream and the headers browsers require for `EventSource`
	 * to work — the event stream type, no caching, and a kept-alive connection.
	 *
	 * @param source - The {@link SseSource} producing events. Return a cleanup
	 * function from it to keep the stream open indefinitely.
	 * @param retry - Reconnection delay in milliseconds, sent with every event to
	 * tell the client how long to wait before reconnecting.
	 * @returns This response, for chaining.
	 */
	sse(source: SseSource, retry?: number): this {
		const encoder = new TextEncoder();
		const stream = createStream((controller, isCancelled) => {
			return source((event) => {
				if (isCancelled()) return;
				let chunk = "";
				if (isPresent(retry)) chunk += `retry: ${retry}\n`;
				if (event.id) chunk += `id: ${event.id}\n`;
				if (event.event) chunk += `event: ${event.event}\n`;
				chunk += `data: ${JSON.stringify(event.data)}\n\n`;
				controller.enqueue(encoder.encode(chunk));
			});
		});
		this.body = stream;
		this.headers.set(HeaderKey.ContentType, "text/event-stream");
		this.headers.set(HeaderKey.CacheControl, "no-cache");
		this.headers.set(HeaderKey.Connection, "keep-alive");
		return this;
	}

	/**
	 * Turns the response into a newline-delimited JSON stream.
	 *
	 * Each item is serialized onto its own line, so a client can parse results as
	 * they arrive instead of waiting for a whole array. Useful for large result
	 * sets and progressive output where the event semantics of {@link Res.sse} are
	 * not needed.
	 *
	 * @param source - The {@link NdjsonSource} producing items. Return a cleanup
	 * function from it to keep the stream open indefinitely.
	 * @returns This response, for chaining.
	 */
	ndjson(source: NdjsonSource): this {
		const encoder = new TextEncoder();
		const stream = createStream((controller, isCancelled) => {
			return source((item) => {
				if (isCancelled()) return;
				controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
			});
		});
		this.body = stream;
		this.headers.set(HeaderKey.ContentType, "application/x-ndjson");
		this.headers.set(HeaderKey.CacheControl, "no-cache");
		return this;
	}

	/**
	 * Streams a file as the response body, without reading it into memory. Prefer
	 * this over {@link Res.file} for anything large.
	 *
	 * @param fileOrPath - An {@link XFile} or a path to one.
	 * @param disposition - `"inline"` to display in the browser, `"attachment"` to
	 * prompt a download under the file's own name.
	 * @returns This response, for chaining.
	 * @throws {@link Exception} with {@link Status.NOT_FOUND} when the file does
	 * not exist.
	 */
	streamFile(
		fileOrPath: XFile | string,
		disposition: ContentDispositionDefinition["disposition"],
	): this {
		const file = resolveFile(fileOrPath);
		const stream = file.stream();
		this.body = stream;
		this.headers.set(HeaderKey.ContentType, file.mimeType);
		this.headers.set(
			HeaderKey.ContentDisposition,
			createContentDispositionHeader({
				disposition: disposition,
				filename: file.fullname,
			}),
		);
		return this;
	}

	/**
	 * Sends a file as the response body, read into memory so it can carry an exact
	 * `Content-Length`. Use {@link Res.streamFile} instead for large files.
	 *
	 * @param fileOrPath - An {@link XFile} or a path to one.
	 * @returns This response, for chaining.
	 * @throws {@link Exception} with {@link Status.NOT_FOUND} when the file does
	 * not exist.
	 */
	file(fileOrPath: XFile | string): this {
		const file = resolveFile(fileOrPath);
		const bytes = file.bytes();
		this.body = bytes;
		this.headers.set(HeaderKey.ContentType, file.mimeType);
		this.headers.set(HeaderKey.ContentLength, bytes.byteLength.toString());
		return this;
	}

	/**
	 * Redirects the client to another URL.
	 *
	 * @param url - Where to send the client, absolute or relative.
	 * @param status - Which redirect to use. Defaults to {@link Status.FOUND}, a
	 * temporary redirect that browsers do not cache. See
	 * {@link Res.permanentRedirect}, {@link Res.temporaryRedirect} and
	 * {@link Res.seeOther} for the named alternatives.
	 * @returns This response, for chaining.
	 */
	redirect(url: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302): this {
		this.status = status;
		const urlString = url instanceof URL ? url.toString() : url;
		this.headers.set(HeaderKey.Location, urlString);
		return this;
	}

	/**
	 * Redirects with {@link Status.MOVED_PERMANENTLY}, which browsers and search
	 * engines cache indefinitely. Use it only when the resource has really moved
	 * for good.
	 *
	 * @param url - Where to send the client.
	 * @returns This response, for chaining.
	 */
	permanentRedirect(url: string | URL): this {
		return this.redirect(url, Status.MOVED_PERMANENTLY);
	}

	/**
	 * Redirects with {@link Status.TEMPORARY_REDIRECT}, which preserves the
	 * original method and body — unlike {@link Status.FOUND}, which clients
	 * commonly turn into a GET.
	 *
	 * @param url - Where to send the client.
	 * @returns This response, for chaining.
	 */
	temporaryRedirect(url: string | URL): this {
		return this.redirect(url, Status.TEMPORARY_REDIRECT);
	}

	/**
	 * Redirects with {@link Status.SEE_OTHER}, which explicitly switches the
	 * client to a GET. This is the correct redirect after a successful POST, since
	 * it stops a refresh from resubmitting the form.
	 *
	 * @param url - Where to send the client.
	 * @returns This response, for chaining.
	 */
	seeOther(url: string | URL): this {
		return this.redirect(url, Status.SEE_OTHER);
	}
}

export { Res, Status };

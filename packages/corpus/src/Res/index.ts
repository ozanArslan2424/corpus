import { Cookies } from "@/Cookies";
import { Exception } from "@/Exception";
import {
	createContentDispositionHeader,
	HeaderKey,
	type ContentDispositionDefinition,
} from "@/Headers";
import { enumerate, type ValueOf } from "@/utils/enum";
import {
	type MaybePromise,
	type Nullable,
	type Optional,
	isNil,
	isNull,
	isUndefined,
} from "@/utils/maybe";
import { isPrimitive } from "@/utils/primitive";
import { type Tuple, tuple } from "@/utils/tuple";
import { lazy, type Lazy, type LazyMut } from "@/utils/variable";
import { XFile } from "@/XFile";

/** Commonly used HTTP status codes. */
const Status = enumerate({
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
});

type Status = ValueOf<typeof Status> | (number & {});

function resolveResBody(b: unknown): Tuple<Nullable<BodyInit>, Nullable<string>> {
	if (isNil(b)) return tuple(null, null);

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

type SseSource = (
	send: (item: { data: unknown; event?: string; id?: string }) => void,
) => MaybePromise<void | (() => void)>;

type NdjsonSource = (send: (item: unknown) => void) => MaybePromise<void | (() => void)>;

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

function resolveFile(fileOrPath: XFile | string): XFile {
	const file = fileOrPath instanceof XFile ? fileOrPath : new XFile(fileOrPath);
	if (!file.exists()) {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND, { filePath: file.path });
	}
	return file;
}

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

interface ResInit extends ResponseInit {
	cookies?: Cookies;
}

class Res<R = unknown> {
	constructor(body?: Nullable<BodyInit | R>, init?: ResInit) {
		this.body = isUndefined(body) ? null : body;

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

	body: Nullable<BodyInit | R> = null;
	status: number;
	statusText: string;

	private _headers: LazyMut<Headers>;
	get headers(): Headers {
		return this._headers();
	}

	private _cookies: Lazy<Cookies>;
	get cookies(): Cookies {
		return this._cookies();
	}

	toNativeResponse(): Response {
		const data = this.body;
		const headers = this.headers;
		const status = this.status;
		const statusText = this.statusText;
		const [body, contentType] = resolveResBody(data);
		if (!isNull(contentType) && !headers.has(HeaderKey.ContentType)) {
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

	sse(source: SseSource, retry?: number): this {
		const encoder = new TextEncoder();
		const stream = createStream((controller, isCancelled) => {
			return source((event) => {
				if (isCancelled()) return;
				let chunk = "";
				if (!isUndefined(retry)) chunk += `retry: ${retry}\n`;
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

	file(fileOrPath: XFile | string): this {
		const file = resolveFile(fileOrPath);
		const bytes = file.bytes();
		this.body = bytes;
		this.headers.set(HeaderKey.ContentType, file.mimeType);
		this.headers.set(HeaderKey.ContentLength, bytes.byteLength.toString());
		return this;
	}

	redirect(url: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302): this {
		this.status = status;
		const urlString = url instanceof URL ? url.toString() : url;
		this.headers.set(HeaderKey.Location, urlString);
		return this;
	}

	permanentRedirect(url: string | URL): this {
		return this.redirect(url, Status.MOVED_PERMANENTLY);
	}

	temporaryRedirect(url: string | URL): this {
		return this.redirect(url, Status.TEMPORARY_REDIRECT);
	}

	seeOther(url: string | URL): this {
		return this.redirect(url, Status.SEE_OTHER);
	}
}

export { Res, Status };

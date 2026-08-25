import { isUndefined } from "@ozanarslan/utils";

import { wrapCookieMap } from "@/Cookies/wrapCookieMap";
import { ContentDispositionDirective } from "@/Directives/ContentDispositionDirective";
import { DefaultStatusTexts } from "@/enums/DefaultStatusTexts";
import { HeaderKey } from "@/enums/HeaderKey";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { resolveResBody } from "@/Res/resolveResBody";
import type { ResInit, SseSource, NdjsonSource } from "@/Res/types";
import { XFile } from "@/XFile/XFile";

/**
 * Represents an HTTP response. Pass it a body and optional init to construct a response,
 * or use the static methods for common patterns like redirects and streaming.
 *
 * The body is automatically serialized based on its type:
 * - `null` / `undefined` → empty body with `text/plain`
 * - Primitives (`string`, `number`, `boolean`, `bigint`) → string with `text/plain`
 * - `Date` → ISO string with `text/plain`
 * - Plain objects and arrays → JSON string with `application/json`
 * - `ArrayBuffer` → binary with `application/octet-stream`
 * - `Blob` → binary with the Blob's own mime type
 * - `FormData` → multipart with `multipart/form-data`
 * - `URLSearchParams` → encoded with `application/x-www-form-urlencoded`
 * - `ReadableStream` → streamed as-is, set `Content-Type` manually via `init.headers`
 * - Custom class instances → falls back to `.toString()`
 *
 * Use {@link Res.response} to get the native web `Response` to return from a route handler.
 *
 * Static helpers:
 * - {@link Res.redirect} / {@link Res.permanentRedirect} / {@link Res.temporaryRedirect} / {@link Res.seeOther} — HTTP redirects
 * - {@link Res.sse} — Server-Sent Events stream
 * - {@link Res.ndjson} — Newline-delimited JSON stream
 * - {@link Res.streamFile} — Stream a file from disk
 * - {@link Res.file} — Respond with a static file
 */

export class Res<R = unknown> {
	constructor(
		body?: BodyInit | R | null | undefined,
		protected readonly init?: ResInit | Res,
	) {
		if (init?.status) this.status = init.status;
		if (init?.statusText) this.statusText = init.statusText;
		this.body = body; // runs through the setter below
	}

	private _body: BodyInit | R | null | undefined;
	private _resolvedBody: BodyInit | null | undefined;

	public get body(): BodyInit | R | null | undefined {
		return this._body;
	}
	public set body(value: BodyInit | R | null | undefined) {
		this._body = value;
		const [resolved, contentType] = resolveResBody(value);
		this._resolvedBody = resolved;
		if (!isUndefined(contentType) && !this.headers.has(HeaderKey.ContentType)) {
			this.headers.set(HeaderKey.ContentType, contentType);
		}
	}

	get response(): Response {
		return new Response(this._resolvedBody, {
			status: this.status,
			statusText: this.statusText,
			headers: this._headers,
		});
	}

	private _statusText: string | undefined;
	public get statusText(): string {
		if (isUndefined(this._statusText)) {
			this._statusText =
				DefaultStatusTexts[this._status ?? this.init?.status ?? Status.OK] ?? "Unknown";
		}
		return this._statusText;
	}
	public set statusText(value: string) {
		this._statusText = value;
	}

	private _status: Status | undefined;
	public get status(): Status {
		if (!isUndefined(this._status)) return this._status;

		if (this.init?.status) {
			this._status = this.init.status;
			return this._status;
		}

		if (this._headers?.has(HeaderKey.Location)) {
			this._status = Status.FOUND;
			return this._status;
		}

		this._status = Status.OK;
		return this._status;
	}
	public set status(value: Status) {
		this._status = value;
	}

	private _headers: Headers | undefined;
	public get headers(): Headers {
		if (!isUndefined(this._headers)) return this._headers;
		this._headers = new Headers(this.init?.headers);
		return this._headers;
	}
	public set headers(value: Headers) {
		this._headers = value;
	}

	private _cookies: Bun.CookieMap | undefined;
	public get cookies(): Bun.CookieMap {
		if (!isUndefined(this._cookies)) return this._cookies;
		const map =
			this.init?.cookies instanceof Bun.CookieMap
				? this.init.cookies
				: new Bun.CookieMap(this.init?.cookies);
		this._cookies = wrapCookieMap(map, this.syncCookieHeaders);
		return this._cookies;
	}
	public set cookies(value: Bun.CookieMap) {
		this._cookies = wrapCookieMap(value, this.syncCookieHeaders);
		this.syncCookieHeaders(this._cookies);
	}

	private syncCookieHeaders = (target: Bun.CookieMap): void => {
		this.headers.delete(HeaderKey.SetCookie);
		for (const header of target.toSetCookieHeaders()) {
			this.headers.append(HeaderKey.SetCookie, header);
		}
	};

	static redirect(url: string | URL, init?: ResInit): Res {
		const res = new Res(undefined, {
			...init,
			status: init?.status ?? Status.FOUND,
			statusText: init?.statusText ?? DefaultStatusTexts[Status.FOUND],
		});
		const urlString = url instanceof URL ? url.toString() : url;
		res.headers.set(HeaderKey.Location, urlString);
		return res;
	}

	static permanentRedirect(url: string | URL, init?: Omit<ResInit, "status">): Res {
		return this.redirect(url, {
			...init,
			status: Status.MOVED_PERMANENTLY,
		});
	}

	static temporaryRedirect(url: string | URL, init?: Omit<ResInit, "status">): Res {
		return this.redirect(url, { ...init, status: Status.TEMPORARY_REDIRECT });
	}

	static seeOther(url: string | URL, init?: Omit<ResInit, "status">): Res {
		return this.redirect(url, { ...init, status: Status.SEE_OTHER });
	}

	private static createStream(
		execute: (
			controller: ReadableStreamDefaultController,
			isCancelled: () => boolean,
		) => Bun.MaybePromise<(() => void) | void>,
	): ReadableStream {
		let cancelled = false;
		let cleanupPromise: Promise<(() => void) | void> | undefined;
		return new ReadableStream({
			start(controller) {
				cleanupPromise = (async () => {
					try {
						const cleanup = await execute(controller, () => cancelled);
						if (typeof cleanup !== "function") {
							controller.close();
						}
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

	static sse(source: SseSource, init?: Omit<ResInit, "status">, retry?: number): Res {
		const encoder = new TextEncoder();
		const stream = this.createStream((controller, isCancelled) => {
			return source((event) => {
				if (isCancelled()) return;
				let chunk = "";
				if (retry !== undefined) chunk += `retry: ${retry}\n`;
				if (event.id) chunk += `id: ${event.id}\n`;
				if (event.event) chunk += `event: ${event.event}\n`;
				chunk += `data: ${JSON.stringify(event.data)}\n\n`;
				controller.enqueue(encoder.encode(chunk));
			});
		});
		const res = new Res(stream, { ...init, status: Status.OK });
		res.headers.set(HeaderKey.ContentType, "text/event-stream");
		res.headers.set(HeaderKey.CacheControl, "no-cache");
		res.headers.set(HeaderKey.Connection, "keep-alive");
		return res;
	}

	static ndjson(source: NdjsonSource, init?: Omit<ResInit, "status">): Res {
		const encoder = new TextEncoder();
		const stream = this.createStream((controller, isCancelled) => {
			return source((item) => {
				if (isCancelled()) return;
				controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
			});
		});
		const res = new Res(stream, { ...init, status: Status.OK });
		res.headers.set(HeaderKey.ContentType, "application/x-ndjson");
		res.headers.set(HeaderKey.CacheControl, "no-cache");
		return res;
	}

	private static async resolveFile(
		fileOrPath: XFile | string,
		init?: Omit<ResInit, "status">,
	): Promise<XFile> {
		let file: XFile;

		if (fileOrPath instanceof XFile) {
			file = fileOrPath;
		} else {
			file = new XFile(fileOrPath);
			const exists = await file.exists();
			if (!exists) {
				throw new Exception(
					Status.NOT_FOUND.toString(),
					Status.NOT_FOUND,
					new Res({ filePath: fileOrPath }, init),
				);
			}
		}

		return file;
	}

	static async streamFile(
		fileOrPath: XFile | string,
		disposition: "attachment" | "inline" = "attachment",
		init?: Omit<ResInit, "status">,
	): Promise<Res<ReadableStream<Uint8Array>>> {
		const file = await this.resolveFile(fileOrPath, init);
		const stream = await file.stream();
		const res = new Res(stream, { ...init, status: Status.OK });
		res.headers.set(HeaderKey.ContentType, file.mimeType);
		res.headers.set(
			HeaderKey.ContentDisposition,
			ContentDispositionDirective.createHeaderString({
				disposition: disposition,
				filename: file.fullname,
			}),
		);
		return res;
	}

	static async file(fileOrPath: XFile | string, init?: ResInit): Promise<Res<string>> {
		const file = await this.resolveFile(fileOrPath, init);
		const content = await file.text();
		const res = new Res(content, init);
		res.headers.set(HeaderKey.ContentType, file.mimeType);
		res.headers.set(HeaderKey.ContentLength, content.length.toString());
		return res;
	}
}

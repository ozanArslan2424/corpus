import { Cookies, CookiesAbstract } from "@/C/Cookies";
import { wrapCookieMap } from "@/C/Cookies/wrapCookieMap";
import { Exception } from "@/C/Exception/Exception";
import { createContentDispositionHeader } from "@/C/Headers";
import { HeaderKey } from "@/C/Headers/HeaderKey";
import { DefaultStatusTexts } from "@/C/Res/DefaultStatusTexts";
import { ResAbstract } from "@/C/Res/Res.abstract";
import type { ResInit, SseSource, NdjsonSource } from "@/C/Res/Res.types";
import { resolveResBody } from "@/C/Res/resolveResBody";
import { Status } from "@/C/Res/Status";
import { isUndefined } from "@/utils";
import { XFile } from "@/X/XFile/XFile";

export class Res<R = unknown> extends ResAbstract<R> {
	constructor(
		body?: BodyInit | R | null | undefined,
		protected readonly init?: ResInit | Res,
	) {
		super();
		if (init?.status) this.status = init.status;
		if (init?.statusText) this.statusText = init.statusText;
		this.body = body; // runs through the setter below
	}

	get response(): Response {
		return new Response(this._resolvedBody, {
			status: this.status,
			statusText: this.statusText,
			headers: this._headers,
		});
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

	private _cookies: CookiesAbstract | undefined;
	public get cookies(): CookiesAbstract {
		if (!isUndefined(this._cookies)) return this._cookies;
		const map =
			this.init?.cookies instanceof CookiesAbstract
				? this.init.cookies
				: new Cookies(this.init?.cookies);
		this._cookies = wrapCookieMap(map, this.syncCookieHeaders);
		return this._cookies;
	}
	public set cookies(value: CookiesAbstract) {
		this._cookies = wrapCookieMap(value, this.syncCookieHeaders);
		this.syncCookieHeaders(this._cookies);
	}

	private syncCookieHeaders = (target: CookiesAbstract): void => {
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
			createContentDispositionHeader({
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

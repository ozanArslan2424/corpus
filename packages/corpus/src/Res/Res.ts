import { CHeaders } from "@/CHeaders/CHeaders";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import { Cookies } from "@/Cookies/Cookies";
import type { CookiesInterface } from "@/Cookies/CookiesInterface";
import { Exception } from "@/Exception/Exception";
import type { NdjsonSource } from "@/Res/NdjsonSource";
import type { ResBody } from "@/Res/ResBody";
import type { ResInit } from "@/Res/ResInit";
import type { SseSource } from "@/Res/SseSource";
import { DefaultStatusTexts } from "@/Status/DefaultStatusTexts";
import { Status } from "@/Status/Status";
import { isNil } from "@/utils/nil";
import { isPrimitive } from "@/utils/primitives";
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
		public data?: ResBody<R>,
		protected readonly init?: ResInit | Res,
	) {
		this.cookies = this.resolveCookies();
		this.headers = this.resolveHeaders();
		this.body = this.resolveBody();
		this.status = this.resolveStatus();
		this.statusText = Res.getDefaultStatusText(this.status);
	}

	body: BodyInit;
	headers: CHeaders;
	status: Status;
	statusText: string;
	cookies: CookiesInterface;

	get response(): Response {
		const setCookieHeaders = this.cookies.toSetCookieHeaders();

		if (setCookieHeaders.length > 0) {
			for (const header of setCookieHeaders) {
				this.headers.append(CommonHeaders.SetCookie, header);
			}
		}

		return new Response(this.body, {
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
		});
	}

	private resolveCookies(): CookiesInterface {
		return new Cookies(this.init?.cookies);
	}

	private resolveHeaders(): CHeaders {
		return new CHeaders(this.init?.headers);
	}

	private resolveStatus(): Status {
		if (this.init?.status) return this.init.status;
		if (this.headers.has(CommonHeaders.Location)) {
			return Status.FOUND;
		}
		return Status.OK;
	}

	private setContentType(value: string): void {
		if (
			!this.headers.has(CommonHeaders.ContentType) ||
			this.headers.get(CommonHeaders.ContentType) === "text/plain"
		) {
			this.headers.set(CommonHeaders.ContentType, value);
		}
	}

	// order important here
	private resolveBody(): BodyInit {
		if (isNil(this.data)) {
			this.setContentType("text/plain");
			return "";
		}

		if (isPrimitive(this.data)) {
			this.setContentType("text/plain");
			return String(this.data);
		}

		if (this.data instanceof ArrayBuffer) {
			this.setContentType("application/octet-stream");
			return this.data;
		}

		if (this.data instanceof Blob) {
			if (this.data.type) this.setContentType(this.data.type);
			return this.data;
		}

		if (this.data instanceof FormData) {
			this.setContentType("multipart/form-data");
			return this.data;
		}

		if (this.data instanceof URLSearchParams) {
			this.setContentType("application/x-www-form-urlencoded");
			return this.data;
		}

		if (this.data instanceof ReadableStream) {
			return this.data;
		}

		if (this.data instanceof Date) {
			this.setContentType("text/plain");
			return this.data.toISOString();
		}

		if (Array.isArray(this.data) || typeof this.data === "object") {
			this.setContentType("application/json");
			return JSON.stringify(this.data);
		}

		// Handle other objects (custom classes, etc.)
		this.setContentType("text/plain");
		// oxlint-disable-next-line typescript/no-base-to-string
		return String(this.data);
	}

	static redirect(url: string | URL, init?: ResInit): Res {
		const res = new Res(undefined, {
			...init,
			status: init?.status ?? Status.FOUND,
			statusText: init?.statusText ?? DefaultStatusTexts[Status.FOUND],
		});
		const urlString = url instanceof URL ? url.toString() : url;
		res.headers.set(CommonHeaders.Location, urlString);
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

	static sse(source: SseSource, init?: Omit<ResInit, "status">, retry?: number): Res {
		const encoder = new TextEncoder();
		const stream = Res.createStream((controller, isCancelled) => {
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
		res.headers.setMany({
			[CommonHeaders.ContentType]: "text/event-stream",
			[CommonHeaders.CacheControl]: "no-cache",
			[CommonHeaders.Connection]: "keep-alive",
		});
		return res;
	}

	static ndjson(source: NdjsonSource, init?: Omit<ResInit, "status">): Res {
		const encoder = new TextEncoder();
		const stream = Res.createStream((controller, isCancelled) => {
			return source((item) => {
				if (isCancelled()) return;
				controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
			});
		});
		const res = new Res(stream, { ...init, status: Status.OK });
		res.headers.setMany({
			[CommonHeaders.ContentType]: "application/x-ndjson",
			[CommonHeaders.CacheControl]: "no-cache",
		});
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
		res.headers.setMany({
			[CommonHeaders.ContentType]: file.mimeType,
			[CommonHeaders.ContentDisposition]: `${disposition}; filename="${file.fullname}"`,
		});
		return res;
	}

	static async file(fileOrPath: XFile | string, init?: ResInit): Promise<Res<string>> {
		const file = await this.resolveFile(fileOrPath, init);
		const content = await file.text();
		const res = new Res(content, init);
		res.headers.setMany({
			[CommonHeaders.ContentType]: file.mimeType,
			[CommonHeaders.ContentLength]: content.length.toString(),
		});
		return res;
	}

	static getDefaultStatusText(status: number): string {
		return DefaultStatusTexts[status] ?? "Unknown";
	}

	private static createStream(
		execute: (
			controller: ReadableStreamDefaultController,
			isCancelled: () => boolean,
		) => (() => void) | void,
	): ReadableStream {
		let cancelled = false;
		let cleanup: (() => void) | void;

		return new ReadableStream({
			start(controller) {
				try {
					cleanup = execute(controller, () => cancelled);
					if (typeof cleanup !== "function") {
						controller.close();
					}
				} catch (err) {
					controller.error(err);
				}
			},
			cancel() {
				cancelled = true;
				cleanup?.();
			},
		});
	}
}

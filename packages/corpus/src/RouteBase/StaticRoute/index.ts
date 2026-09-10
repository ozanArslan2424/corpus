/**
 * Serving a file read once at startup, optionally through a handler.
 *
 * {@link StaticRoute} is the {@link RouteVariant.static} member of the
 * {@link RouteBase} family. Unlike {@link FileRoute}, which reads its file per
 * request, this one reads at construction and holds the bytes — so the file is
 * served from memory, and changes on disk are not picked up until the process
 * restarts.
 *
 * The optional callback receives the file's contents as text, which is what
 * makes this the route for templating: an HTML shell can have values injected
 * into it before being sent.
 *
 * ```ts
 * import { StaticRoute } from "@ozanarslan/corpus";
 *
 * new StaticRoute("GET /about", "./pages/about.html");
 * new StaticRoute("GET /", "./pages/index.html", (c, html) => html.replace("{{title}}", title));
 * ```
 *
 * @module StaticRoute
 */

import type { Context, ContextHandler } from "@/Context";
import { Exception } from "@/Exception";
import { createCacheControlHeader, HeaderKey, type CacheControlDefinition } from "@/Headers";
import { Method } from "@/Request";
import { Status, type Res } from "@/Res";
import {
	resolveRouteAddress,
	RouteBase,
	RouteVariant,
	type RouteAddress,
	type RouteConfig,
} from "@/RouteBase";
import { assert } from "@/utils/assert";
import { type Nullable, isAbsent, type MaybePromise } from "@/utils/is";
import { XFile } from "@/XFile";

/**
 * Transforms a static file's contents before they are sent.
 *
 * @param context - The {@link Context} for the request.
 * @param content - The file's contents, decoded as UTF-8 text.
 * @returns What to send: a string, raw bytes, or a {@link Res} for full control
 * over the response.
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 */
type StaticRouteCallback<B = unknown, S = unknown, P = unknown> = (
	context: Context<B, S, P, StaticRouteRes>,
	content: string,
) => MaybePromise<StaticRouteRes>;

/**
 * What a {@link StaticRoute} handler resolves to: the file's bytes when there is
 * no callback, or whatever the {@link StaticRouteCallback} returned.
 */
type StaticRouteRes = Uint8Array | string | Res;

/**
 * A {@link RouteConfig} that also carries a caching policy.
 *
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 */
interface StaticRouteConfig<B = unknown, S = unknown, P = unknown> extends RouteConfig<
	B,
	S,
	P,
	StaticRouteRes
> {
	/**
	 * Caching policy for the served file. Defaults to one hour of public caching.
	 */
	cache?: CacheControlDefinition;
}

/**
 * Serves a file held in memory, optionally passing it through a callback first.
 *
 * The file is read once during construction and kept as bytes, so every request
 * is answered without touching the filesystem. A file that does not exist at
 * that point is not an error — the route registers, and requests reach
 * {@link StaticRoute.onFileNotFound} instead.
 *
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam E - The literal endpoint type, carried so the endpoint stays
 * narrowly typed at the call site.
 */
class StaticRoute<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, StaticRouteRes, E> {
	/**
	 * Creates a static route for subclasses, which declare
	 * {@link StaticRoute.endpoint} and {@link StaticRoute.file} as class fields and
	 * call {@link RouteBase.register} themselves.
	 */
	constructor();
	/**
	 * Creates a static route, reads its file, and registers it on the nearest
	 * {@link App}.
	 *
	 * @param address - The {@link RouteAddress}: a `"METHOD /endpoint"` string or a
	 * method-and-endpoint pair.
	 * @param filePath - Path to the file, read now rather than per request.
	 * @param callback - Optional {@link StaticRouteCallback} to transform the
	 * contents before sending. Omit it to send the file as-is.
	 * @param config - Optional {@link StaticRouteConfig} with validation schemas
	 * and a caching policy.
	 */
	constructor(
		address: RouteAddress<E>,
		filePath: string,
		callback?: StaticRouteCallback<B, S, P>,
		config?: StaticRouteConfig<B, S, P>,
	);
	constructor(
		address?: RouteAddress<E>,
		filePath?: string,
		callback?: StaticRouteCallback<B, S, P>,
		config?: StaticRouteConfig<B, S, P>,
	) {
		super();
		if (new.target !== StaticRoute) return;
		assert.present(address, "address is required when StaticRoute is constructed directly.");
		assert.present(filePath, "filePath is required when StaticRoute is constructed directly.");
		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.endpoint;
		this.method = resolved.method;
		const { cache, ...model } = config ?? {};
		this.config = model;
		this.cacheHeader = createCacheControlHeader(
			cache ?? { public: true, maxAge: 3600, noCache: false },
		);
		this.callback = callback;
		this.file = new XFile(filePath);
		if (this.file.exists()) this.bytes = this.file.bytes();
		this.register();
	}

	/**
	 * The file this route serves. Kept for its mime type and name; the contents
	 * live in {@link StaticRoute.bytes}.
	 */
	file: Nullable<XFile> = null;

	/**
	 * The file's contents, read at construction. `null` when the file did not
	 * exist then, which is what sends requests to
	 * {@link StaticRoute.onFileNotFound}.
	 */
	bytes: Nullable<Uint8Array> = null;

	/**
	 * The `Cache-Control` value sent with the file, rendered from the config at
	 * construction rather than per request.
	 */
	cacheHeader: string = "";

	/**
	 * Transforms the file's contents before they are sent. Absent means the bytes
	 * are sent unchanged.
	 */
	callback?: StaticRouteCallback<B, S, P>;

	/**
	 * Decides what to serve when the file was missing at construction. Replace it
	 * to serve a placeholder or redirect instead of throwing.
	 *
	 * @returns The {@link StaticRouteRes} to send instead.
	 * @throws {@link Exception} with {@link Status.NOT_FOUND} by default.
	 */
	onFileNotFound: () => Promise<StaticRouteRes> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	/** Marks this route as {@link RouteVariant.static} for {@link App} route compilation. */
	override readonly variant: RouteVariant = RouteVariant.static;

	/** The method the file is served on. Taken from the {@link RouteAddress}; defaults to {@link Method.GET}. */
	override method: Method = Method.GET;

	/** The path the file is served at. */
	override endpoint!: E;

	/**
	 * Validation schemas for the route. The caching policy is stripped out during
	 * construction, so what remains is a plain {@link RouteConfig}.
	 */
	override config?: RouteConfig<B, S, P, StaticRouteRes>;

	/**
	 * Sends the file, or the callback's transformation of it.
	 *
	 * The content type, caching and length headers are set from the file before
	 * the callback runs, so a callback that changes the content's length — or
	 * returns a {@link Res} of its own — should set those headers itself.
	 *
	 * @param c - The {@link Context} for the request.
	 * @returns The file's bytes, or whatever the {@link StaticRoute.callback}
	 * returned. Falls through to {@link StaticRoute.onFileNotFound} when the file
	 * was missing at construction.
	 */
	override handler: ContextHandler<B, S, P, StaticRouteRes> = (c) => {
		if (isAbsent(this.file)) return this.onFileNotFound();
		if (isAbsent(this.bytes)) return this.onFileNotFound();
		c.res.headers.set(HeaderKey.ContentType, this.file.mimeType);
		c.res.headers.set(HeaderKey.CacheControl, this.cacheHeader);
		c.res.headers.set(HeaderKey.ContentLength, this.bytes.byteLength.toString());
		if (isAbsent(this.callback)) return this.bytes;
		const decoder = new TextDecoder();
		return this.callback(c, decoder.decode(this.bytes));
	};
}

export { StaticRoute };

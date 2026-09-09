/**
 * Serving a single file from a single endpoint.
 *
 * {@link FileRoute} is the {@link RouteVariant.file} member of the
 * {@link RouteBase} family, and the narrowest of the file-serving routes: one
 * endpoint, one file, no path resolution. Reach for {@link BundleRoute} to serve
 * a whole directory, or {@link StaticRoute} when the file's contents feed a
 * handler rather than being sent as-is.
 *
 * ```ts
 * import { FileRoute } from "@ozanarslan/corpus";
 *
 * new FileRoute("GET /robots.txt", "./public/robots.txt");
 * new FileRoute("GET /report", { filePath: "./report.pdf", disposition: "attachment" });
 * ```
 *
 * @module FileRoute
 */

import type { ContextHandler } from "@/Context";
import { Exception } from "@/Exception";
import {
	type ContentDispositionDefinition,
	type CacheControlDefinition,
	createCacheControlHeader,
	createContentDispositionHeader,
	HeaderKey,
} from "@/Headers";
import { Method } from "@/Request";
import { Status } from "@/Res";
import {
	RouteBase,
	type RouteAddress,
	resolveRouteAddress,
	RouteVariant,
	type RouteConfig,
} from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isString } from "@/utils/lexical";
import { isNil } from "@/utils/maybe";
import { XFile } from "@/XFile";

/**
 * Describes the file a {@link FileRoute} serves and how it is sent. Pass a bare
 * path string instead when the defaults suffice.
 */
interface FileRouteDefinition {
	/** Path to the file, resolved when the request arrives rather than at registration. */
	filePath: string;
	/**
	 * The `Content-Disposition` to send. Setting it also switches the route to
	 * streaming — see {@link FileRoute.disposition}.
	 */
	disposition?: ContentDispositionDefinition["disposition"];
	/** Caching policy. Defaults to {@link FileRoute.cache}. */
	cache?: CacheControlDefinition;
}

/**
 * What a {@link FileRoute} handler resolves to: a stream when a disposition is
 * set, bytes otherwise, or a string when {@link FileRoute.onFileNotFound} is
 * overridden to return one.
 */
type FileRouteRes = ReadableStream<Uint8Array> | Uint8Array | string;

/**
 * Serves one file at one endpoint.
 *
 * The file is read per request, not at registration, so replacing it on disk
 * takes effect without a restart — and a file that does not exist yet is not an
 * error until someone asks for it.
 *
 * How the body is sent depends on {@link FileRoute.disposition}: with one set,
 * the file is streamed and carries a `Content-Disposition`; without one, it is
 * read into memory and carries an exact `Content-Length`.
 *
 * @typeParam E - The literal endpoint type, carried so the endpoint stays
 * narrowly typed at the call site.
 */
class FileRoute<E extends string = string> extends RouteBase<never, never, never, FileRouteRes, E> {
	/**
	 * Creates a file route for subclasses, which declare
	 * {@link FileRoute.endpoint} and {@link FileRoute.filePath} as class fields
	 * and call {@link RouteBase.register} themselves.
	 */
	constructor();
	/**
	 * Creates a file route and registers it on the nearest {@link App}.
	 *
	 * @param address - The {@link RouteAddress}: a `"METHOD /endpoint"` string or a
	 * method-and-endpoint pair.
	 * @param definition - A {@link FileRouteDefinition}, or just the file path when
	 * the default caching and inline sending are fine.
	 */
	constructor(address: RouteAddress<E>, definition: FileRouteDefinition | string);
	constructor(address?: RouteAddress<E>, definition?: FileRouteDefinition | string) {
		super();
		if (new.target !== FileRoute) return;
		assertDefined(address, "address is required when FileRoute is constructed directly.");
		assertDefined(definition, "definition is required when FileRoute is constructed directly.");
		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.endpoint;
		this.method = resolved.method;
		if (isString(definition)) {
			this.filePath = definition;
		} else {
			this.filePath = definition.filePath;
			if (!isNil(definition.disposition)) this.disposition = definition.disposition;
			if (!isNil(definition.cache)) this.cache = definition.cache;
		}
		this.register();
	}

	/** Path to the file to serve, read fresh on every request. */
	filePath!: string;

	/**
	 * The `Content-Disposition` to send — `"inline"` to display in the browser,
	 * `"attachment"` to download under the file's own name.
	 *
	 * Setting it also switches the route to streaming, so large downloads are
	 * never buffered. Leaving it unset sends the bytes with a `Content-Length`
	 * instead, which suits small files a client may want to cache or range over.
	 */
	disposition?: ContentDispositionDefinition["disposition"];

	/**
	 * Caching policy, rendered into `Cache-Control` by
	 * {@link createCacheControlHeader}. Defaults to one hour of public caching.
	 */
	cache: CacheControlDefinition = {
		public: true,
		maxAge: 3600,
		noCache: false,
	};

	/**
	 * Decides what to serve when {@link FileRoute.filePath} does not exist at
	 * request time. Replace it to serve a placeholder or redirect instead of
	 * throwing.
	 *
	 * @returns The {@link FileRouteRes} to send instead.
	 * @throws {@link Exception} with {@link Status.NOT_FOUND} by default.
	 */
	onFileNotFound: () => Promise<FileRouteRes> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	/** Marks this route as {@link RouteVariant.file} for {@link App} route compilation. */
	override readonly variant: RouteVariant = RouteVariant.file;

	/** The method the file is served on. Taken from the {@link RouteAddress}; defaults to {@link Method.GET}. */
	override method: Method = Method.GET;

	/** The path the file is served at. */
	override endpoint!: E;

	/**
	 * File routes take no params, search or body, so no {@link RouteConfig}
	 * schemas apply.
	 */
	override config?: RouteConfig<never, never, never, FileRouteRes> | undefined;

	/**
	 * Reads the file and sends it, setting the content type, caching and length or
	 * disposition headers on {@link Context.res}.
	 *
	 * @param c - The {@link Context} for the request.
	 * @returns The file body — a stream when {@link FileRoute.disposition} is set,
	 * bytes otherwise — or whatever {@link FileRoute.onFileNotFound} produced.
	 */
	override handler: ContextHandler<never, never, never, FileRouteRes> = async (c) => {
		const file = new XFile(this.filePath);
		const exists = file.exists();
		if (!exists) return await this.onFileNotFound();
		const cacheHeader = createCacheControlHeader(this.cache);

		if (!isNil(this.disposition)) {
			const stream = file.stream();
			c.res.headers.setMany({
				[HeaderKey.ContentType]: file.mimeType,
				[HeaderKey.CacheControl]: cacheHeader,
				[HeaderKey.ContentDisposition]: createContentDispositionHeader({
					disposition: this.disposition,
					filename: file.fullname,
				}),
			});
			return stream;
		}

		const content = file.bytes();
		c.res.headers.setMany({
			[HeaderKey.ContentType]: file.mimeType,
			[HeaderKey.CacheControl]: cacheHeader,
			[HeaderKey.ContentLength]: content.byteLength.toString(),
		});
		return content;
	};
}

export { FileRoute };

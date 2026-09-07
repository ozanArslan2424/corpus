/**
 * Serving for a directory of built front-end files: hashed assets, an entry
 * document, and per-file-class caching.
 *
 * {@link BundleRoute} is the {@link RouteVariant.bundle} member of the
 * {@link RouteBase} family. It serves any directory of servable files, deriving
 * cache headers from what kind of file each one is — immutable for build-hashed
 * assets, revalidated for the entry document, and a configurable fallback for
 * everything else. Its distinguishing behaviour is the entry-document fallback:
 * a path that resolves to no file is answered with the entry HTML instead of a
 * 404, which is what makes a single-page app survive a hard refresh on a client
 * route. That fallback is the main use, not the only one — {@link StaticRoute}
 * remains the plainer choice when a bundle's caching and fallback behaviour is
 * not wanted.
 *
 * ```ts
 * new BundleRoute("/*", "./dist");
 * ```
 *
 * @module BundleRoute
 */

import path from "path";

import type { ContextHandler } from "@/Context";
import { Exception } from "@/Exception";
import {
	createCacheControlHeader,
	createContentDispositionHeader,
	HeaderKey,
	type CacheControlDefinition,
} from "@/Headers";
import { Method } from "@/Request";
import { Status, type Res } from "@/Res";
import { RouteBase, RouteVariant, type RouteConfig } from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isUndefined, isNull, type MaybePromise } from "@/utils/maybe";
import { tuple, type Tuple } from "@/utils/tuple";
import { XFile } from "@/XFile";

/**
 * A {@link CacheControlDefinition} that also names the path it applies to,
 * relative to {@link BundleRoute.dir}.
 */
interface CacheControlDefinitionWithPath extends CacheControlDefinition {
	/**
	 * Path relative to {@link BundleRoute.dir}. Falls back to the corresponding
	 * {@link DEFAULT_DEFINITION} value when omitted.
	 */
	path?: string;
}

/**
 * Describes the layout of a bundle directory and the caching policy for each
 * class of file within it. See {@link DEFAULT_DEFINITION} for the values used
 * when this is not supplied.
 */
interface BundleRouteDefinition {
	/**
	 * The entry document — its path within the bundle, and how it should be
	 * cached. Also the file served by the fallback in
	 * {@link BundleRoute.resolveFile}.
	 */
	indexHtml: CacheControlDefinitionWithPath;
	/**
	 * The directory holding build-hashed assets, and how they should be cached.
	 * Files below it are matched by path segment, not by extension.
	 */
	assetsDir: CacheControlDefinitionWithPath;
	/**
	 * Caching for every file that is neither the entry document nor under the
	 * assets directory. Omit it to send no `Cache-Control` for those files.
	 */
	fallback?: CacheControlDefinition;
}

/**
 * What a {@link BundleRoute} handler resolves to: a stream for non-HTML files,
 * bytes for HTML, or a string or {@link Res} when
 * {@link BundleRoute.onFileNotFound} is overridden to return one.
 */
type BundleRouteRes = ReadableStream<Uint8Array> | Uint8Array | string | Res;

/**
 * Caching defaults tuned for a conventional Vite build. Used whole when no
 * {@link BundleRouteDefinition} is given, and per field when
 * {@link CacheControlDefinitionWithPath.path} is omitted.
 */
const DEFAULT_DEFINITION = {
	// Vite assets are hashed (index-HASH.js), so they are safe to cache forever.
	assetsDir: {
		path: "assets",
		public: true,
		maxAge: 31536000, // 1 year
		immutable: true,
	},
	// index.html must be checked every time to see if a new version exists.
	indexHtml: {
		path: "index.html",
		noCache: true,
	},
	// Root files (favicon, robots.txt, manifest.json) usually don't have
	// hashes in the filename, so we tell the browser to revalidate them.
	fallback: {
		public: true,
		noCache: true,
	},
} as const;

/**
 * Serves a directory of built files.
 *
 * Register it on a wildcard endpoint so every path below it reaches the route.
 * A request resolves in three steps: the endpoint prefix is stripped to a
 * sub-path by {@link BundleRoute.resolveSubPath}, the sub-path is joined onto
 * {@link BundleRoute.dir} by {@link BundleRoute.resolveTargetPath}, and
 * {@link BundleRoute.resolveFile} serves the result if it exists. When it does
 * not and the request is not for an HTML file, the entry document named by
 * {@link BundleRoute.indexHtmlPath} is served instead.
 *
 * Files are matched against {@link BundleRoute.definition} to pick their
 * `Cache-Control`: the entry document, anything under
 * {@link BundleRoute.assetsDirPath}, and everything else each get their own
 * policy.
 *
 * Paths that escape {@link BundleRoute.dir} are rejected by
 * {@link BundleRoute.isTraversalAttempt} before the filesystem is touched, so
 * `..` segments cannot reach files outside the directory.
 *
 * @typeParam E - The literal endpoint type, carried so the endpoint stays
 * narrowly typed at the call site.
 */
class BundleRoute<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	BundleRouteRes,
	E
> {
	/**
	 * Creates a bundle route for subclasses, which declare
	 * {@link BundleRoute.endpoint} and {@link BundleRoute.dir} as class fields and
	 * call {@link RouteBase.register} themselves.
	 */
	constructor();
	/**
	 * Creates a bundle route and registers it on the nearest {@link App}.
	 *
	 * @param endpoint - The path to serve the directory under. Use a wildcard so
	 * nested paths reach the route.
	 * @param dir - Directory to serve from. Every resolved path is confined to it.
	 * @param definition - Optional {@link BundleRouteDefinition} overriding the
	 * bundle layout and caching policy. Defaults to {@link DEFAULT_DEFINITION}.
	 */
	constructor(endpoint: E, dir: string, definition?: BundleRouteDefinition);
	constructor(endpoint?: E, dir?: string, definition?: BundleRouteDefinition) {
		super();

		if (new.target !== BundleRoute) return;
		assertDefined(endpoint, "endpoint is required when BundleRoute is constructed directly.");
		assertDefined(dir, "dir is required when BundleRoute is constructed directly.");

		this.endpoint = endpoint;
		this.dir = dir;
		if (!isUndefined(definition)) this.definition = definition;
		this.register();
	}

	/**
	 * Directory the files are served from. Every path resolved by the route is
	 * confined to it.
	 */
	dir!: string;

	/**
	 * Sub-paths that are answered with the entry document rather than the file
	 * they name. A trailing `*` makes a pattern a prefix match; leading slashes
	 * are optional.
	 *
	 * Useful when a client-side route collides with a real file in the directory,
	 * or to keep a build artefact from being reachable.
	 */
	ignore: Array<string> = [];

	/**
	 * The bundle's layout and caching policy. Defaults to
	 * {@link DEFAULT_DEFINITION}.
	 */
	definition: BundleRouteDefinition = DEFAULT_DEFINITION;

	// resolved values
	/**
	 * Path of the entry document within {@link BundleRoute.dir}.
	 *
	 * @returns The path from {@link BundleRouteDefinition.indexHtml}, or the
	 * {@link DEFAULT_DEFINITION} value when it declares none.
	 */
	get indexHtmlPath(): string {
		return this.definition.indexHtml.path ?? DEFAULT_DEFINITION.indexHtml.path;
	}

	/**
	 * Path of the hashed-assets directory within {@link BundleRoute.dir}.
	 *
	 * @returns The path from {@link BundleRouteDefinition.assetsDir}, or the
	 * {@link DEFAULT_DEFINITION} value when it declares none.
	 */
	get assetsDirPath(): string {
		return this.definition.assetsDir.path ?? DEFAULT_DEFINITION.assetsDir.path;
	}

	/**
	 * Decides what to serve when a request resolves to no readable file — an HTML
	 * file that is genuinely missing, a directory with no entry document, or a
	 * path rejected by {@link BundleRoute.isTraversalAttempt}.
	 *
	 * Replace it to serve a custom 404 page or redirect instead of throwing.
	 *
	 * @param subPath - The request path with the endpoint prefix stripped, as the
	 * client asked for it.
	 * @returns The {@link BundleRouteRes} to send instead.
	 * @throws {@link Exception} with {@link Status.NOT_FOUND} by default.
	 */
	onFileNotFound: (subPath: string) => MaybePromise<BundleRouteRes> = (subPath) => {
		throw new Exception(`${subPath} file was not found.`, Status.NOT_FOUND);
	};

	/**
	 * Resolves a filesystem path to a readable {@link XFile}, applying the
	 * entry-document fallback.
	 *
	 * A missing non-HTML path falls back to the entry document, which is what
	 * serves client-side routes. A missing HTML path does not fall back — asking
	 * for a specific document that does not exist is a real 404 rather than a
	 * client route.
	 *
	 * @param targetPath - Path produced by {@link BundleRoute.resolveTargetPath}.
	 * @returns The {@link XFile} to serve, or `null` when nothing readable was
	 * found, which sends the request to {@link BundleRoute.onFileNotFound}.
	 */
	protected resolveFile(targetPath: string): XFile | null {
		let file = new XFile(targetPath);
		let exists = file.exists();

		if (!exists && file.extension !== "html") {
			const idxPath = path.join(this.dir, this.indexHtmlPath);
			const idxFile = new XFile(idxPath);

			if (idxFile.exists()) {
				file = idxFile;
				exists = true;
			}
		}

		return exists ? file : null;
	}

	/**
	 * Strips the route's own prefix from a request pathname, leaving the path
	 * relative to {@link BundleRoute.dir}.
	 *
	 * Both `/*` and `*` endpoint suffixes are handled, and a pathname that does
	 * not start with the prefix is returned untouched.
	 *
	 * @param pathname - The pathname of the incoming request.
	 * @returns The bundle-relative sub-path, `""` or `/` for the route root.
	 */
	protected resolveSubPath(pathname: string): string {
		const base = this.endpoint.endsWith("/*")
			? this.endpoint.slice(0, -2)
			: this.endpoint.endsWith("*")
				? this.endpoint.slice(0, -1)
				: this.endpoint;
		return base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	}

	/**
	 * Joins a sub-path onto {@link BundleRoute.dir} to get the file to read.
	 *
	 * The route root maps to the entry document, as does any sub-path matching
	 * {@link BundleRoute.ignore}. The result is not yet known to be safe —
	 * {@link BundleRoute.isTraversalAttempt} checks it before it is opened.
	 *
	 * @param subPath - The sub-path from {@link BundleRoute.resolveSubPath}.
	 * @returns The joined filesystem path.
	 */
	protected resolveTargetPath(subPath: string): string {
		const indexHtml = this.indexHtmlPath;
		const relFilePath = subPath === "" || subPath === "/" ? indexHtml : subPath;

		const isIgnored = this.ignore.some((pattern) => {
			if (pattern.endsWith("*")) {
				const prefix = pattern.slice(0, -1);
				return relFilePath.startsWith(prefix) || relFilePath.startsWith(`/${prefix}`);
			}
			return relFilePath === pattern || relFilePath === `/${pattern}`;
		});

		return path.join(this.dir, isIgnored ? indexHtml : relFilePath);
	}

	/**
	 * Reports whether a resolved path escapes {@link BundleRoute.dir}.
	 *
	 * Both sides are fully resolved before comparison, so `..` segments and
	 * encoded variants are normalised away rather than matched textually. The
	 * separator check keeps a sibling directory sharing the root's name prefix
	 * from passing.
	 *
	 * @param targetPath - Path from {@link BundleRoute.resolveTargetPath}.
	 * @returns `true` when the path lies outside the served directory, in which
	 * case the request goes to {@link BundleRoute.onFileNotFound} without the file
	 * being opened.
	 */
	protected isTraversalAttempt(targetPath: string): boolean {
		const root = path.resolve(this.dir);
		const resolved = path.resolve(targetPath);
		return resolved !== root && !resolved.startsWith(root + path.sep);
	}

	/**
	 * Produces the response body and headers for a resolved file.
	 *
	 * `Cache-Control` is chosen by matching the file against
	 * {@link BundleRoute.definition}: the entry document first, then anything
	 * under {@link BundleRoute.assetsDirPath}, then
	 * {@link BundleRouteDefinition.fallback}. No fallback means no header.
	 *
	 * Non-HTML files are streamed and carry an inline
	 * `Content-Disposition`, so large assets are never buffered. HTML is read into
	 * memory instead, which lets it carry an exact `Content-Length` — the entry
	 * document is small and served constantly, so the length is worth more than
	 * the streaming.
	 *
	 * @param file - The {@link XFile} resolved for the request.
	 * @returns A {@link Tuple} of the body and the headers to set on
	 * {@link Res.headers}.
	 */
	protected resolveResponseData(
		file: XFile,
	): Tuple<ReadableStream | Uint8Array, Record<string, string>> {
		let cacheHeader: string = "";
		if (file.fullname === this.indexHtmlPath) {
			cacheHeader = createCacheControlHeader(this.definition.indexHtml);
		} else if (file.path.includes(`/${this.assetsDirPath}/`)) {
			cacheHeader = createCacheControlHeader(this.definition.assetsDir);
		} else if (this.definition.fallback) {
			cacheHeader = createCacheControlHeader(this.definition.fallback);
		}

		if (file.extension !== "html") {
			const stream = file.stream();
			return tuple(stream, {
				[HeaderKey.ContentType]: file.mimeType,
				[HeaderKey.CacheControl]: cacheHeader,
				[HeaderKey.ContentDisposition]: createContentDispositionHeader({
					disposition: "inline",
					filename: file.fullname,
				}),
			});
		}

		const bytes = file.bytes();
		return tuple(bytes, {
			[HeaderKey.ContentType]: file.mimeType,
			[HeaderKey.CacheControl]: cacheHeader,
			[HeaderKey.ContentLength]: bytes.byteLength.toString(),
		});
	}

	/** Marks this route as {@link RouteVariant.bundle} for {@link App} route compilation. */
	override readonly variant: RouteVariant = RouteVariant.bundle;

	/** Bundles answer {@link Method.GET} only. */
	override readonly method: Method = Method.GET;

	/**
	 * The path the directory is served under. Use a wildcard so nested paths reach
	 * the route; {@link BundleRoute.resolveSubPath} strips the wildcard suffix.
	 */
	override endpoint!: E;

	/**
	 * Bundles take no params, search or body, so no {@link RouteConfig} schemas
	 * apply.
	 */
	override readonly config?: RouteConfig<never, never, never, BundleRouteRes>;

	/**
	 * Serves the file a request resolves to.
	 *
	 * Resolves the sub-path and target path, rejects traversal attempts, reads the
	 * file, then sets the headers from {@link BundleRoute.resolveResponseData} on
	 * {@link Context.res} and returns the body. Anything that fails to resolve
	 * goes to {@link BundleRoute.onFileNotFound}.
	 *
	 * @param c - The {@link Context} for the request.
	 * @returns The file body — a stream for non-HTML, bytes for HTML — or whatever
	 * {@link BundleRoute.onFileNotFound} produced.
	 */
	override handler: ContextHandler<never, never, never, BundleRouteRes> = (c) => {
		const subPath = this.resolveSubPath(c.url.pathname);
		const targetPath = this.resolveTargetPath(subPath);

		if (this.isTraversalAttempt(targetPath)) {
			return this.onFileNotFound(subPath);
		}

		const file = this.resolveFile(targetPath);
		if (isNull(file)) return this.onFileNotFound(subPath);

		const [data, headers] = this.resolveResponseData(file);
		c.res.headers.setMany(headers);
		return data;
	};
}

export { BundleRoute };

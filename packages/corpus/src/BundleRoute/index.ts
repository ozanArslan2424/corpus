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

interface CacheControlDefinitionWithPath extends CacheControlDefinition {
	path?: string;
}

interface BundleRouteDefinition {
	indexHtml: CacheControlDefinitionWithPath;
	assetsDir: CacheControlDefinitionWithPath;
	fallback?: CacheControlDefinition;
}

type BundleRouteRes = ReadableStream<Uint8Array> | Uint8Array | string | Res;

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

class BundleRoute<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	BundleRouteRes,
	E
> {
	constructor();
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

	dir!: string;
	ignore: Array<string> = [];
	definition: BundleRouteDefinition = DEFAULT_DEFINITION;
	// resolved values
	get indexHtmlPath(): string {
		return this.definition.indexHtml.path ?? DEFAULT_DEFINITION.indexHtml.path;
	}
	get assetsDirPath(): string {
		return this.definition.assetsDir.path ?? DEFAULT_DEFINITION.assetsDir.path;
	}

	onFileNotFound: (subPath: string) => MaybePromise<BundleRouteRes> = (subPath) => {
		throw new Exception(`${subPath} file was not found.`, Status.NOT_FOUND);
	};

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

	protected resolveSubPath(pathname: string): string {
		const base = this.endpoint.endsWith("/*")
			? this.endpoint.slice(0, -2)
			: this.endpoint.endsWith("*")
				? this.endpoint.slice(0, -1)
				: this.endpoint;
		return base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	}

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

	protected isTraversalAttempt(targetPath: string): boolean {
		const root = path.resolve(this.dir);
		const resolved = path.resolve(targetPath);
		return resolved !== root && !resolved.startsWith(root + path.sep);
	}

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

	override readonly variant: RouteVariant = RouteVariant.bundle;
	override readonly method: Method = Method.GET;
	override endpoint!: E;
	override readonly config?: RouteConfig<never, never, never, BundleRouteRes>;
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

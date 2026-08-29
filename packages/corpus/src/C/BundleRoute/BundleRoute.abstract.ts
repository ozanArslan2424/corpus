import path from "path";

import type { BundleRouteCacheConfig } from "@/C/BundleRoute/BundleRoute.types";
import { Exception } from "@/C/Exception";
import { createCacheControlHeader, HeaderKey, createContentDispositionHeader } from "@/C/Headers";
import { Method } from "@/C/Req";
import { Res, Status } from "@/C/Res";
import type { ContextHandler } from "@/C/Route";
import { RouteBase, RouteVariant, type RouteModel } from "@/C/RouteBase";
import type { StaticRouteRes } from "@/C/StaticRoute";
import { type Func, isNull, objGetEntries } from "@/utils";
import { XFile } from "@/X/XFile";

export abstract class BundleRouteAbstract<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	StaticRouteRes,
	E
> {
	override readonly variant: RouteVariant = RouteVariant.bundle;
	override readonly method: Method = Method.GET;
	override readonly model?: RouteModel<never, never, never, StaticRouteRes> | undefined = undefined;

	abstract readonly dir: string;
	protected readonly indexHtml: string = "index.html";
	protected assetsDir: string = "assets";
	protected ignore: string[] = [];
	protected cache: BundleRouteCacheConfig = {
		// Vite assets are hashed (index-HASH.js), so they are safe to cache forever.
		assetsDir: {
			public: true,
			maxAge: 31536000, // 1 year
			immutable: true,
		},
		// index.html must be checked every time to see if a new version exists.
		indexHtml: {
			noCache: true,
		},
		// Root files (favicon, robots.txt, manifest.json) usually don't have
		// hashes in the filename, so we tell the browser to revalidate them.
		fallback: {
			public: true,
			noCache: true,
		},
	};

	protected onFileNotFound: Func<[subPath: string], Bun.MaybePromise<Res>> = (subPath) => {
		throw new Exception(`${subPath} file was not found.`, Status.NOT_FOUND);
	};

	protected async resolveFile(targetPath: string): Promise<XFile | null> {
		let file = new XFile(targetPath);
		let exists = await file.exists();

		if (!exists && file.extension !== "html") {
			const idxPath = path.join(this.dir, this.indexHtml);
			const idxFile = new XFile(idxPath);

			if (await idxFile.exists()) {
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
		const relFilePath = subPath === "" || subPath === "/" ? this.indexHtml : subPath;

		const isIgnored = this.ignore.some((pattern) => {
			if (pattern.endsWith("*")) {
				const prefix = pattern.slice(0, -1);
				return relFilePath.startsWith(prefix) || relFilePath.startsWith(`/${prefix}`);
			}
			return relFilePath === pattern || relFilePath === `/${pattern}`;
		});

		return path.join(this.dir, isIgnored ? this.indexHtml : relFilePath);
	}

	protected isTraversalAttempt(targetPath: string): boolean {
		const root = path.resolve(this.dir);
		const resolved = path.resolve(targetPath);
		return resolved !== root && !resolved.startsWith(root + path.sep);
	}

	protected async resolveResponseData(
		file: XFile,
	): Promise<[ReadableStream | string, Record<string, string>]> {
		let cacheHeader: string = "";
		if (file.fullname === this.indexHtml) {
			cacheHeader = createCacheControlHeader(this.cache.indexHtml);
		} else if (file.path.includes(`/${this.assetsDir}/`)) {
			cacheHeader = createCacheControlHeader(this.cache.assetsDir);
		} else if (this.cache.fallback) {
			cacheHeader = createCacheControlHeader(this.cache.fallback);
		}

		if (file.extension !== "html") {
			const stream = await file.stream();
			return [
				stream,
				{
					[HeaderKey.ContentType]: file.mimeType,
					[HeaderKey.CacheControl]: cacheHeader,
					[HeaderKey.ContentDisposition]: createContentDispositionHeader({
						disposition: "inline",
						filename: file.fullname,
					}),
				},
			];
		}

		const content = await file.text();
		return [
			content,
			{
				[HeaderKey.ContentType]: file.mimeType,
				[HeaderKey.ContentLength]: content.length.toString(),
				[HeaderKey.CacheControl]: cacheHeader,
			},
		];
	}

	override handler: ContextHandler<never, never, never, StaticRouteRes> = async (c) => {
		const subPath = this.resolveSubPath(c.url.pathname);
		const targetPath = this.resolveTargetPath(subPath);

		if (this.isTraversalAttempt(targetPath)) {
			return this.onFileNotFound(subPath);
		}

		const file = await this.resolveFile(targetPath);
		if (isNull(file)) {
			return this.onFileNotFound(subPath);
		}

		const [data, headers] = await this.resolveResponseData(file);
		for (const [key, value] of objGetEntries(headers)) {
			c.res.headers.set(key, value);
		}
		return data;
	};
}

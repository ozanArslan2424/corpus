import path from "path";

import type { Func } from "@ozanarslan/utils";

import type { BundleRouteCacheConfig } from "@/C/BundleRoute/BundleRoute.types";
import { CacheControlDirective } from "@/C/CacheControlDirective/CacheControlDirective";
import { ContentDispositionDirective } from "@/C/ContentDispositionDirective/ContentDispositionDirective";
import { Exception } from "@/C/Exception/Exception";
import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import { Method } from "@/C/Method/Method";
import type { Res } from "@/C/Res/Res";
import type { ContextHandler } from "@/C/Route/Route.types";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import { RouteVariant, type RouteModel } from "@/C/RouteBase/RouteBase.types";
import type { StaticRouteRes } from "@/C/StaticRoute/StaticRoute.types";
import { Status } from "@/C/Status/Status";
import { XFile } from "@/X/XFile/XFile";

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

	protected onIgnore: Func<[], Bun.MaybePromise<Res>> = () => {
		return this.onFileNotFound("");
	};

	override handler: ContextHandler<never, never, never, StaticRouteRes> = async (c) => {
		const idx = "index.html";
		const pathname = c.url.pathname;

		const base = this.endpoint.endsWith("/*")
			? this.endpoint.slice(0, -2)
			: this.endpoint.endsWith("*")
				? this.endpoint.slice(0, -1)
				: this.endpoint;
		const subPath = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

		const relFilePath = subPath === "" || subPath === "/" ? idx : subPath;
		const targetPath = path.join(this.dir, relFilePath);

		// guard against traversal
		const root = path.resolve(this.dir);
		const resolved = path.resolve(targetPath);
		if (resolved !== root && !resolved.startsWith(root + path.sep)) {
			return this.onFileNotFound(subPath);
		}

		const isIgnored = this.ignore.some((pattern) => {
			if (pattern.endsWith("*")) {
				const prefix = pattern.slice(0, -1);
				return relFilePath.startsWith(prefix) || relFilePath.startsWith(`/${prefix}`);
			}
			return relFilePath === pattern || relFilePath === `/${pattern}`;
		});

		if (isIgnored) {
			return this.onIgnore();
		}

		let file = new XFile(targetPath);
		let exists = await file.exists();

		if (!exists && file.extension !== "html") {
			const idxPath = path.join(this.dir, idx);
			const idxFile = new XFile(idxPath);

			if (await idxFile.exists()) {
				file = idxFile;
				exists = true;
			}
		}

		if (!exists) {
			return this.onFileNotFound(subPath);
		}

		let cacheHeader = "";

		if (file.fullname === idx) {
			cacheHeader = CacheControlDirective.createHeaderString(this.cache.indexHtml);
		} else if (file.path.includes(`/${this.assetsDir}/`)) {
			cacheHeader = CacheControlDirective.createHeaderString(this.cache.assetsDir);
		} else if (this.cache.fallback) {
			cacheHeader = CacheControlDirective.createHeaderString(this.cache.fallback);
		}

		if (file.extension !== "html") {
			const stream = await file.stream();
			c.res.headers.set(HeaderKey.ContentType, file.mimeType);
			c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
			c.res.headers.set(
				HeaderKey.ContentDisposition,
				ContentDispositionDirective.createHeaderString({
					disposition: "inline",
					filename: file.fullname,
				}),
			);
			return stream;
		}

		const content = await file.text();
		c.res.headers.set(HeaderKey.ContentType, file.mimeType);
		c.res.headers.set(HeaderKey.ContentLength, content.length.toString());
		c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
		return content;
	};
}

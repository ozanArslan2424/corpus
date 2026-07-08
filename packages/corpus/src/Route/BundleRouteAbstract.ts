import path from "node:path";

import { CacheControlDirective } from "@/CacheControlDirective/CacheControlDirective";
import type { Context } from "@/Context/Context";
import { CommonHeaders } from "@/enums/CommonHeaders";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { Res } from "@/Res/Res";
import { BaseRoute } from "@/Route/BaseRoute";
import {
	RouteVariant,
	type BundleRouteCacheConfig,
	type RouteModel,
	type StaticRouteRes,
} from "@/Route/types";
import type { Func } from "@/utils/functions";
import { XFile } from "@/XFile/XFile";

export abstract class BundleRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BaseRoute<B, S, P, StaticRouteRes, E> {
	override readonly variant: RouteVariant = RouteVariant.bundle;

	abstract readonly dir: string;

	override method: Method = Method.GET;

	override model?: RouteModel<B, S, P, StaticRouteRes> | undefined = undefined;

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

	handler: Func<[Context<B, S, P, StaticRouteRes>], Bun.MaybePromise<StaticRouteRes>> = async (
		c,
	) => {
		const idx = "index.html";
		const pathname = c.url.pathname;
		const subPath = pathname.startsWith(this.endpoint)
			? pathname.slice(this.endpoint.length)
			: pathname;

		const relFilePath = subPath === "" || subPath === "/" ? idx : subPath;
		const targetPath = path.join(this.dir, relFilePath);

		const isIgnored = this.ignore.some((pattern) => {
			if (pattern.endsWith("*")) {
				const prefix = pattern.slice(0, -1);
				return relFilePath.startsWith(prefix);
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

		let res: Res;

		if (file.extension === "html") {
			res = await Res.file(file);
		} else {
			res = await Res.streamFile(file, "inline");
		}

		if (file.name === idx) {
			res.headers.set(
				CommonHeaders.CacheControl,
				CacheControlDirective.createHeaderString(this.cache.indexHtml),
			);
		} else if (file.path.includes(`/${this.assetsDir}/`)) {
			res.headers.set(
				CommonHeaders.CacheControl,
				CacheControlDirective.createHeaderString(this.cache.assetsDir),
			);
		} else if (this.cache.fallback) {
			res.headers.set(
				CommonHeaders.CacheControl,
				CacheControlDirective.createHeaderString(this.cache.fallback),
			);
		}

		return res;
	};
}

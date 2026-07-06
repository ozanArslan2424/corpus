import path from "node:path";

import type { Func } from "corpus-utils/Func";
import type { MaybePromise } from "corpus-utils/MaybePromise";

import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import type { RouteModel } from "@/BaseRoute/RouteModel";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import type { BundleRouteConfig } from "@/BundleRoute/BundleRouteConfig";
import { CacheControlDirective } from "@/CommonHeaders/CacheControlDirective";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import type { Context } from "@/Context/Context";
import { Exception } from "@/Exception/Exception";
import { Method } from "@/Method/Method";
import { Res } from "@/Res/Res";
import { Status } from "@/Status/Status";
import { XFile } from "@/XFile/XFile";

type R = Res | string;

export abstract class BundleRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BaseRouteAbstract<B, S, P, R, E> {
	// FROM CONSTRUCTOR
	abstract readonly path: E;

	abstract readonly dir: string;

	// PROTECTED

	protected ignore: BundleRouteConfig["ignore"] = [];

	protected cache: BundleRouteConfig["cache"] = {
		// Vite assets are hashed (index-HASH.js), so they are safe to cache forever.
		assetsDir: {
			public: true,
			maxAge: 31536000, // 1 year
			immutable: true,
		},
		// index.html must be checked every time to see if a new version exists.
		indexHtml: "no-cache",
		// Root files (favicon, robots.txt, manifest.json) usually don't have
		// hashes in the filename, so we tell the browser to revalidate them.
		fallback: {
			public: true,
			noCache: true,
		},
	};

	protected assetsDir: BundleRouteConfig["assetsDir"] = "assets";

	protected onFileNotFound: BundleRouteConfig["onFileNotFound"] = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	protected onIgnore: BundleRouteConfig["onIgnore"] = () => {
		return this.onFileNotFound();
	};

	// ROUTE BASE PROPERTIES
	readonly variant: RouteVariant = RouteVariant.bundle;
	readonly model?: RouteModel<B, S, P, R> | undefined = undefined;

	get endpoint(): E {
		return this.path;
	}

	get method(): Method {
		return Method.GET;
	}

	get handler(): Func<[Context<B, S, P, R>], MaybePromise<R>> {
		return async (c) => {
			const idx = "index.html";
			const pathname = c.req.urlObject.pathname;
			const subPath = pathname.startsWith(this.path) ? pathname.slice(this.path.length) : pathname;

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
				return this.onFileNotFound();
			}

			const res =
				file.extension !== "html" ? await Res.streamFile(file, "inline") : await Res.file(file);

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
}

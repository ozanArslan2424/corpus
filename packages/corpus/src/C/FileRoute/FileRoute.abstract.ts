import { type Func, isNil } from "@/utils";

import { CacheControlDirective } from "@/C/CacheControlDirective/CacheControlDirective";
import { ContentDispositionDirective } from "@/C/ContentDispositionDirective/ContentDispositionDirective";
import type { Context } from "@/C/Context/Context";
import { Exception } from "@/C/Exception/Exception";
import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import { Method } from "@/C/Method/Method";
import { Res } from "@/C/Res/Res";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import { RouteVariant } from "@/C/RouteBase/RouteBase.types";
import type { StaticRouteRes } from "@/C/StaticRoute/StaticRoute.types";
import { Status } from "@/C/Status/Status";
import { XFile } from "@/X/XFile/XFile";

export abstract class FileRouteAbstract<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	StaticRouteRes,
	E
> {
	readonly variant: RouteVariant = RouteVariant.file;

	abstract filePath: string;

	override method: Method = Method.GET;

	protected disposition?: ContentDispositionDirective["disposition"] | undefined = undefined;

	protected cache: CacheControlDirective = { public: true, maxAge: 3600, noCache: false };

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	get handler(): Func<
		[Context<never, never, never, StaticRouteRes>],
		Bun.MaybePromise<StaticRouteRes>
	> {
		const cacheHeader = CacheControlDirective.createHeaderString(this.cache);

		return async (c) => {
			const file = new XFile(this.filePath);
			const exists = await file.exists();
			if (!exists) return await this.onFileNotFound();

			if (!isNil(this.disposition)) {
				const stream = await file.stream();
				c.res.headers.set(HeaderKey.ContentType, file.mimeType);
				c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
				c.res.headers.set(
					HeaderKey.ContentDisposition,
					ContentDispositionDirective.createHeaderString({
						disposition: this.disposition,
						filename: file.fullname,
					}),
				);
				return stream;
			}

			const content = await file.text();
			c.res.headers.set(HeaderKey.ContentType, file.mimeType);
			c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
			c.res.headers.set(HeaderKey.ContentLength, content.length.toString());
			return content;
		};
	}
}

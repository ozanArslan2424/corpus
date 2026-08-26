import { type Func, isNil } from "@ozanarslan/utils";

import { BaseRoute } from "@/C/BaseRouteAbstract";
import { CacheControlDirective } from "@/C/CacheControlDirective";
import { ContentDispositionDirective } from "@/C/ContentDispositionDirective";
import type { Context } from "@/C/Context";
import { Exception } from "@/C/Exception";
import { HeaderKey } from "@/C/HeaderKey";
import { Method } from "@/C/Method";
import { Res } from "@/C/Res";
import { type StaticRouteRes, RouteVariant } from "@/C/Route/types";
import { Status } from "@/C/Status";
import { XFile } from "@/X/XFile";

export abstract class FileRouteAbstract<E extends string = string> extends BaseRoute<
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

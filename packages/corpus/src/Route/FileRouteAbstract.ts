import type { Context } from "@/Context/Context";
import { CacheControlDirective } from "@/Directives/CacheControlDirective";
import { ContentDispositionDirective } from "@/Directives/ContentDispositionDirective";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { Res } from "@/Res/Res";
import { BaseRoute } from "@/Route/BaseRoute";
import { type StaticRouteRes, RouteVariant } from "@/Route/types";
import type { Func } from "@/utils/functions";
import { isNil } from "@/utils/is";
import { XFile } from "@/XFile/XFile";

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

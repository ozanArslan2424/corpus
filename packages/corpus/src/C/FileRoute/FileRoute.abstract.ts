import type { Context } from "@/C/Context/Context";
import { Exception } from "@/C/Exception/Exception";
import { createCacheControlHeader } from "@/C/Headers/createCacheControlHeader";
import { createContentDispositionHeader } from "@/C/Headers/createContentDispositionHeader";
import { HeaderKey } from "@/C/Headers/HeaderKey";
import type {
	CacheControlDefinition,
	ContentDispositionDefinition,
} from "@/C/Headers/Headers.types";
import { Method } from "@/C/Req/Method";
import { Res } from "@/C/Res/Res";
import { Status } from "@/C/Res/Status";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import type { StaticRouteRes } from "@/C/StaticRoute/StaticRoute.types";
import { type Func, isNil } from "@/utils";
import { XFile } from "@/X/XFile/XFile";

import { RouteVariant } from "../RouteBase/RouteVariant";

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

	protected disposition?: ContentDispositionDefinition["disposition"] | undefined = undefined;

	protected cache: CacheControlDefinition = { public: true, maxAge: 3600, noCache: false };

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	get handler(): Func<
		[Context<never, never, never, StaticRouteRes>],
		Bun.MaybePromise<StaticRouteRes>
	> {
		const cacheHeader = createCacheControlHeader(this.cache);

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
					createContentDispositionHeader({
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

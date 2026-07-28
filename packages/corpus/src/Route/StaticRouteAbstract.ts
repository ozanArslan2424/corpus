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

export abstract class StaticRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BaseRoute<B, S, P, StaticRouteRes, E> {
	readonly variant: RouteVariant = RouteVariant.static;

	abstract filePath: string;

	override method: Method = Method.GET;

	protected callback?: Func<
		[context: Context<B, S, P, StaticRouteRes>, content: string],
		Bun.MaybePromise<StaticRouteRes>
	>;

	protected disposition?: ContentDispositionDirective["type"] | undefined = undefined;

	protected cache: CacheControlDirective = { public: true, maxAge: 3600, noCache: false };

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	get handler(): Func<[Context<B, S, P, StaticRouteRes>], Bun.MaybePromise<StaticRouteRes>> {
		const cacheHeader = CacheControlDirective.createHeaderString(this.cache);

		return async (c) => {
			const file = new XFile(this.filePath);
			const exists = await file.exists();
			if (!exists) {
				return this.onFileNotFound();
			}

			if (!isNil(this.disposition)) {
				const stream = await file.stream();
				c.res.headers.set(HeaderKey.ContentType, file.mimeType);
				c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
				c.res.headers.set(
					HeaderKey.ContentDisposition,
					ContentDispositionDirective.createHeaderString({
						type: this.disposition,
						filename: file.fullname,
					}),
				);
				return stream;
			}

			const content = await file.text();
			c.res.headers.set(HeaderKey.ContentType, file.mimeType);
			c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
			c.res.headers.set(HeaderKey.ContentLength, content.length.toString());
			return isNil(this.callback) ? content : this.callback(c, content);
		};
	}
}

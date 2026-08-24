import type { Func } from "@ozanarslan/utils/function";

import type { Context } from "@/Context/Context";
import { CacheControlDirective } from "@/Directives/CacheControlDirective";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { Res } from "@/Res/Res";
import { BaseRoute } from "@/Route/BaseRoute";
import { type StaticRouteRes, RouteVariant } from "@/Route/types";
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

	protected callback: Func<
		[context: Context<B, S, P, StaticRouteRes>, content: string],
		Bun.MaybePromise<StaticRouteRes>
	> = (_, content) => content;

	protected cache: CacheControlDirective = { public: true, maxAge: 3600, noCache: false };

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	get handler(): Func<[Context<B, S, P, StaticRouteRes>], Bun.MaybePromise<StaticRouteRes>> {
		const cacheHeader = CacheControlDirective.createHeaderString(this.cache);

		return async (c) => {
			const file = new XFile(this.filePath);
			const exists = await file.exists();
			if (!exists) return await this.onFileNotFound();

			const content = await file.text();
			c.res.headers.set(HeaderKey.ContentType, file.mimeType);
			c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
			c.res.headers.set(HeaderKey.ContentLength, content.length.toString());
			return await this.callback(c, content);
		};
	}
}

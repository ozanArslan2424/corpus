import type { Func } from "@ozanarslan/utils";

import { BaseRoute } from "@/C/BaseRouteAbstract";
import { CacheControlDirective } from "@/C/CacheControlDirective";
import type { Context } from "@/C/Context";
import { Exception } from "@/C/Exception";
import { HeaderKey } from "@/C/HeaderKey";
import { Method } from "@/C/Method";
import { Res } from "@/C/Res";
import { type StaticRouteRes, RouteVariant } from "@/C/Route/types";
import { Status } from "@/C/Status";
import { XFile } from "@/X/XFile";

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

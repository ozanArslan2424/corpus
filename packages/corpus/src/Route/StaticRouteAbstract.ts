import { CacheControlDirective } from "@/CacheControlDirective/CacheControlDirective";
import type { Context } from "@/Context/Context";
import { CommonHeaders } from "@/enums/CommonHeaders";
import { Method } from "@/enums/Method";
import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import { Res } from "@/Res/Res";
import { BaseRoute } from "@/Route/BaseRoute";
import { type StaticRouteRes, RouteVariant } from "@/Route/types";
import type { Func } from "@/utils/functions";
import { isNil } from "@/utils/nil";
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

	protected disposition?: "attachment" | "inline" | undefined = undefined;

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

			if (this.callback !== undefined) {
				const content = await file.text();
				c.res.headers.setMany({
					[CommonHeaders.ContentType]: file.mimeType,
					[CommonHeaders.ContentLength]: content.length.toString(),
					[CommonHeaders.CacheControl]: cacheHeader,
				});
				return this.callback(c, content);
			}

			let res: Res;

			if (isNil(this.disposition)) {
				res = await Res.file(file);
			} else {
				res = await Res.streamFile(file, this.disposition);
			}

			res.headers.set(CommonHeaders.CacheControl, cacheHeader);
			return res;
		};
	}
}

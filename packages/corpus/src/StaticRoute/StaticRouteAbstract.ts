import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { CacheControlDirective } from "@/CommonHeaders/CacheControlDirective";
import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import type { Context } from "@/Context/Context";
import { Exception } from "@/Exception/Exception";
import { Res } from "@/Res/Res";
import type { StaticRouteCallback } from "@/StaticRoute/StaticRouteCallback";
import { Status } from "@/Status/Status";
import type { Func } from "@/utils/functions";
import { isNil } from "@/utils/nil";
import { XFile } from "@/XFile/XFile";

type StaticRouteRes = Res | string;

export abstract class StaticRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BaseRouteAbstract<B, S, P, StaticRouteRes, E> {
	readonly variant: RouteVariant = RouteVariant.static;

	abstract readonly callback?: StaticRouteCallback<B, S, P>;

	abstract filePath: string;

	abstract disposition?: "attachment" | "inline";

	abstract cache?: CacheControlDirectiveInterface;

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	get handler(): Func<[Context<B, S, P, StaticRouteRes>], Bun.MaybePromise<StaticRouteRes>> {
		const customHandler = this.callback;

		const cacheHeader = CacheControlDirective.createHeaderString(
			this.cache ?? { public: true, maxAge: 3600, noCache: false },
		);

		return async (c) => {
			const file = new XFile(this.filePath);
			const exists = await file.exists();
			if (!exists) {
				return this.onFileNotFound();
			}

			if (customHandler !== undefined) {
				const content = await file.text();
				c.res.headers.setMany({
					[CommonHeaders.ContentType]: file.mimeType,
					[CommonHeaders.ContentLength]: content.length.toString(),
					[CommonHeaders.CacheControl]: cacheHeader,
				});
				return customHandler(c, content);
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

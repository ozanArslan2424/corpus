import type { Func } from "corpus-utils/Func";
import { isNil } from "corpus-utils/isNil";
import type { MaybePromise } from "corpus-utils/MaybePromise";

import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { CacheControlDirective } from "@/CommonHeaders/CacheControlDirective";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";
import type { Context } from "@/Context/Context";
import { Exception } from "@/Exception/Exception";
import { Method } from "@/Method/Method";
import { Res } from "@/Res/Res";
import type { StaticRouteCallback } from "@/StaticRoute/StaticRouteCallback";
import type { StaticRouteDefinition } from "@/StaticRoute/StaticRouteDefinition";
import { Status } from "@/Status/Status";
import { XFile } from "@/XFile/XFile";

type R = Res | string;

export abstract class StaticRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BaseRouteAbstract<B, S, P, R, E> {
	// FROM CONSTRUCTOR
	abstract readonly path: E;

	abstract readonly definition: StaticRouteDefinition;

	abstract readonly callback?: StaticRouteCallback<B, S, P>;

	// PROTECTED

	protected onFileNotFound: Func<[], Promise<Res>> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	protected get filePath(): string {
		return typeof this.definition === "string" ? this.definition : this.definition.filePath;
	}

	// ROUTE BASE PROPERTIES
	readonly variant: RouteVariant = RouteVariant.static;

	get endpoint(): E {
		return this.path;
	}

	get method(): Method {
		return typeof this.definition === "string"
			? Method.GET
			: (this.definition.method ?? Method.GET);
	}

	get handler(): Func<[Context<B, S, P, R>], MaybePromise<R>> {
		const customHandler = this.callback;
		const isStrDef = typeof this.definition === "string";

		const cacheHeader = CacheControlDirective.createHeaderString(
			!isStrDef && !!this.definition.cache
				? this.definition.cache
				: { public: true, maxAge: 3600, noCache: false },
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

			if (!isStrDef && !isNil(this.definition.disposition)) {
				res = await Res.streamFile(file, this.definition.disposition);
			} else {
				res = await Res.file(file);
			}

			res.headers.set(CommonHeaders.CacheControl, cacheHeader);
			return res;
		};
	}
}

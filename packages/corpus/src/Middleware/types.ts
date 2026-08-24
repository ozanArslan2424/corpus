import type { Func } from "@ozanarslan/utils/function";

import type { Context } from "@/Context/Context";
import type { Controller } from "@/Controller/Controller";
import type { BaseRoute } from "@/Route/BaseRoute";

export type MiddlewareHandler<R = unknown> = Func<
	[context: Context, next: Func<[], Bun.MaybePromise<R>>],
	Bun.MaybePromise<R>
>;

export type MiddlewareOptions = {
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

export type MiddlewareUseOn =
	| Array<BaseRoute<any, any, any, any> | Controller | string>
	| BaseRoute<any, any, any, any>
	| Controller
	| "*";

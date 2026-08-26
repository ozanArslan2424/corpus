import type { Func } from "@ozanarslan/utils";

import type { BaseRoute } from "@/C/BaseRouteAbstract";
import type { Context } from "@/C/Context";
import type { Controller } from "@/C/Controller";

export type MiddlewareHandler<R = unknown> = Func<
	[context: Context, next: Func<[], Bun.MaybePromise<R>>],
	Bun.MaybePromise<R>
>;

export type MiddlewareUseOn =
	| Array<BaseRoute<any, any, any, any> | Controller | string>
	| BaseRoute<any, any, any, any>
	| Controller
	| "*";

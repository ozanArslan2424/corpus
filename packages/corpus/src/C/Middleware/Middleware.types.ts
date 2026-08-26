import type { Func } from "@ozanarslan/utils";

import type { Context } from "@/C/Context/Context";
import type { Controller } from "@/C/Controller/Controller";
import type { RouteBase } from "@/C/RouteBase/RouteBase";

export type MiddlewareHandler<R = unknown> = Func<
	[context: Context, next: Func<[], Bun.MaybePromise<R>>],
	Bun.MaybePromise<R>
>;

export type MiddlewareUseOn =
	| Array<RouteBase<any, any, any, any> | Controller | string>
	| RouteBase<any, any, any, any>
	| Controller
	| "*";

export type MiddlewareDefinition = {
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

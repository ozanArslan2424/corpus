import type { Context } from "@/C/Context/Context";
import type { Controller } from "@/C/Controller/Controller";
import type { RouteBase } from "@/C/RouteBase/RouteBase";
import type { Func } from "@/utils";

export type MiddlewareHandler<R = unknown> = Func<
	[context: Context, next: Func<[], Bun.MaybePromise<R>>],
	Bun.MaybePromise<R>
>;

export type MiddlewareUseOn = Array<RouteBase | Controller | string> | RouteBase | Controller | "*";

export type MiddlewareDefinition = {
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

import type { Context } from "@/Context/Context";
import type { Controller } from "@/Controller/Controller";
import type { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { Func } from "@/utils/functions";

export type MiddlewareHandler = Func<
	[context: Context, next: Func<[], Bun.MaybePromise<Res | void>>],
	Bun.MaybePromise<Res | void>
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

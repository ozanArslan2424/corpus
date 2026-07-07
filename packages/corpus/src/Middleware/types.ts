import type { Context } from "@/Context/Context";
import type { Controller } from "@/Controller/Controller";
import type { Res } from "@/Res/Res";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { Func } from "@/utils/functions";
import type { ValueOf } from "@/utils/ValueOf";

export const MiddlewareVariant = {
	inbound: "inbound",
	outbound: "outbound",
} as const;

export type MiddlewareVariant = ValueOf<typeof MiddlewareVariant>;

export type MiddlewareHandler = Func<[context: Context], Bun.MaybePromise<void | Res>>;

export type MiddlewareOptions = {
	variant?: MiddlewareVariant;
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

export type MiddlewareUseOn =
	| Array<BaseRoute<any, any, any, any> | Controller | string>
	| BaseRoute<any, any, any, any>
	| Controller
	| "*";

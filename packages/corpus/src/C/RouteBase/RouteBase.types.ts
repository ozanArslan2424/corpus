import { enumerate, type ValueOf, type Schema } from "@ozanarslan/utils";

import type { Method } from "@/C/Method/Method";

export type RouteHandleInput<B, S, P> = {
	body?: B;
	search?: S;
	params?: P;
	headers?: HeadersInit;
};

export const RouteVariant = enumerate({
	static: "static",
	file: "file",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
});

export type RouteVariant = ValueOf<typeof RouteVariant>;

export type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| `${Lowercase<Method>} ${E}`
	| { method: Method; path: E };

export type RouteConfig = {
	maxRequestBodySize?: number;
};

export type RouteModel<B = unknown, S = unknown, P = unknown, R = unknown> = {
	config?: RouteConfig;
	response?: Schema<R>;
	body?: Schema<B>;
	search?: Schema<S>;
	params?: Schema<P>;
};

import type { MiddlewareHandler, MiddlewareUseOn } from "@/C/MiddlewareAbstract/types";

export type MiddlewareOptions = {
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

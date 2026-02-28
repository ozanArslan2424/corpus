import { getRouterInstance } from "@/index";
import type { MiddlewareHandler } from "@/Middleware/types/MiddlewareHandler";
import type { MiddlewareOptions } from "@/Middleware/types/MiddlewareOptions";
import type { MiddlewareUseOn } from "@/Middleware/types/MiddlewareUseOn";

/**
 * Simple middleware that runs before the Route "callback" parameters.
 * Manipulates context.
 * */

export class Middleware {
	constructor(opts: MiddlewareOptions) {
		this.useOn = opts.useOn;
		this.handler = opts.handler;
		getRouterInstance().addMiddleware(opts);
	}

	useOn: MiddlewareUseOn;
	handler: MiddlewareHandler;
}

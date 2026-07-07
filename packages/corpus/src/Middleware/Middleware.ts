import { MiddlewareAbstract } from "@/Middleware/MiddlewareAbstract";
import type { MiddlewareOptions } from "@/Middleware/types";
import { isNil } from "@/utils/nil";

/**
 * Simple Middleware registration class.
 * variant = "inbound" runs before route handlers
 * variant = "outbound" runs after route handlers
 * Both variants manipulate the context and can return Res or void.
 */

export class Middleware extends MiddlewareAbstract {
	constructor(opts: MiddlewareOptions) {
		super();

		if (!isNil(opts.variant)) this.variant = opts.variant;
		if (!isNil(opts.useOn)) this.useOn = opts.useOn;
		this.handler = opts.handler;

		this.register();
	}

	readonly useOn: Required<MiddlewareOptions>["useOn"] = "*";
	readonly handler: Required<MiddlewareOptions>["handler"];
}

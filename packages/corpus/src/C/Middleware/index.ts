import { isNil } from "@ozanarslan/utils";

import type { MiddlewareOptions } from "@/C/Middleware/types";
import { MiddlewareAbstract } from "@/C/MiddlewareAbstract";

/**
 * Simple Middleware registration class.
 * variant = "inbound" runs before route handlers
 * variant = "outbound" runs after route handlers
 * Both variants manipulate the context and can return Res or void.
 */

export class Middleware extends MiddlewareAbstract {
	constructor(opts: MiddlewareOptions) {
		super();

		if (!isNil(opts.useOn)) this.useOn = opts.useOn;
		this.handler = opts.handler;

		this.register();
	}

	readonly useOn: Required<MiddlewareOptions>["useOn"] = "*";
	readonly handler: Required<MiddlewareOptions>["handler"];
}

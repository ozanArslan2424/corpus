import { isNil } from "@/utils";

import { MiddlewareAbstract } from "@/C/Middleware/Middleware.abstract";
import type {
	MiddlewareDefinition,
	MiddlewareHandler,
	MiddlewareUseOn,
} from "@/C/Middleware/Middleware.types";

/**
 * Simple Middleware registration class.
 * variant = "inbound" runs before route handlers
 * variant = "outbound" runs after route handlers
 * Both variants manipulate the context and can return Res or void.
 */

export class Middleware extends MiddlewareAbstract {
	constructor(definition: MiddlewareDefinition) {
		super();

		if (!isNil(definition.useOn)) this.useOn = definition.useOn;
		this.handler = definition.handler;

		this.register();
	}

	readonly useOn: MiddlewareUseOn = "*";
	readonly handler: MiddlewareHandler;
}

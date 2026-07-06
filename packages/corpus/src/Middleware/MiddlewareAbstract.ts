import type { MiddlewareHandler } from "@/Middleware/MiddlewareHandler";
import type { MiddlewareInterface } from "@/Middleware/MiddlewareInterface";
import type { MiddlewareUseOn } from "@/Middleware/MiddlewareUseOn";
import { MiddlewareVariant } from "@/Middleware/MiddlewareVariant";
import { $registry } from "@/registry";

export abstract class MiddlewareAbstract implements MiddlewareInterface {
	variant: MiddlewareVariant = MiddlewareVariant.inbound;

	abstract useOn: MiddlewareUseOn;

	abstract handler: MiddlewareHandler;

	register(): void {
		$registry.middlewares.add(this);
	}
}

import type { MiddlewareUseOn, MiddlewareHandler } from "@/C/Middleware/Middleware.types";
import { $registry } from "@/Registry/$registry";

export abstract class MiddlewareAbstract {
	abstract useOn: MiddlewareUseOn;

	abstract handler: MiddlewareHandler;

	register(): void {
		$registry.register("middleware", this);
	}
}

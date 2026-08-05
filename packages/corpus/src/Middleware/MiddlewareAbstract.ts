import type { MiddlewareUseOn, MiddlewareHandler } from "@/Middleware/types";
import { $registry } from "@/registry";

export abstract class MiddlewareAbstract {
	abstract useOn: MiddlewareUseOn;

	abstract handler: MiddlewareHandler;

	register(): void {
		$registry.register("middleware", this);
	}
}

import type { MiddlewareUseOn, MiddlewareHandler } from "@/C/MiddlewareAbstract/types";
import { $registry } from "@/Registry/$registry";

export abstract class MiddlewareAbstract {
	abstract useOn: MiddlewareUseOn;

	abstract handler: MiddlewareHandler;

	register(): void {
		$registry.register("middleware", this);
	}
}

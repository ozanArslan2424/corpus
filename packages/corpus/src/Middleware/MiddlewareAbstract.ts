import {
	MiddlewareVariant,
	type MiddlewareUseOn,
	type MiddlewareHandler,
} from "@/Middleware/types";
import { $registry } from "@/registry";

export abstract class MiddlewareAbstract {
	variant: MiddlewareVariant = MiddlewareVariant.inbound;

	abstract useOn: MiddlewareUseOn;

	abstract handler: MiddlewareHandler;

	register(): void {
		$registry.middlewares.add(this);
	}
}

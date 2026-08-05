import { Method } from "@/enums/Method";
import { $registry } from "@/registry";
import type { ContextHandler, RouteModel, RouteVariant } from "@/Route/types";

export abstract class BaseRoute<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> {
	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	abstract handler: ContextHandler<B, S, P, R>;

	abstract endpoint: E;

	abstract method: Method;

	abstract readonly variant: RouteVariant;

	model?: RouteModel<B, S, P, R> | undefined = undefined;

	register(): void {
		$registry.register("route", this);
	}
}

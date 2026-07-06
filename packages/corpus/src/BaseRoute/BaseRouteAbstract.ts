import type { BaseRouteHandler } from "@/BaseRoute/BaseRouteHandler";
import type { BaseRouteInterface } from "@/BaseRoute/BaseRouteInterface";
import type { RouteModel } from "@/BaseRoute/RouteModel";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { $registry } from "@/index";
import { Method } from "@/Method/Method";

export abstract class BaseRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> implements BaseRouteInterface<B, S, P, R, E> {
	abstract get handler(): BaseRouteHandler<B, S, P, R>;

	abstract get endpoint(): E;

	abstract get method(): Method;

	abstract readonly variant: RouteVariant;

	abstract readonly model?: RouteModel<B, S, P, R>;

	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	register(): void {
		$registry.router.add(this);
	}
}

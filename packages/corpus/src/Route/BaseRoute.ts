import type { Context } from "@/Context/Context";
import { Method } from "@/enums/Method";
import { $registry } from "@/registry";
import type { RouteModel, RouteVariant } from "@/Route/types";
import type { Func } from "@/utils/functions";

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

	abstract handler: Func<[context: Context<B, S, P, R>], Bun.MaybePromise<R>>;

	abstract endpoint: E;

	abstract method: Method;

	abstract readonly variant: RouteVariant;

	model?: RouteModel<B, S, P, R> | undefined = undefined;

	register(): void {
		$registry.router.add(this);
	}
}

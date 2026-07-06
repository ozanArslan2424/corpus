import type { BaseRouteHandler } from "@/BaseRoute/BaseRouteHandler";
import type { BaseRouteInterface } from "@/BaseRoute/BaseRouteInterface";
import type { RouteAddress } from "@/BaseRoute/RouteAddress";
import type { RouteModel } from "@/BaseRoute/RouteModel";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import { Method } from "@/Method/Method";
import { $registry } from "@/registry";
import { arrIncludes } from "@/utils/arrays";
import { assert } from "@/utils/assert";
import { objGetValues } from "@/utils/objects";

export abstract class BaseRouteAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> implements BaseRouteInterface<B, S, P, R, E> {
	abstract get handler(): BaseRouteHandler<B, S, P, R>;

	abstract endpoint: E;

	abstract method: Method;

	abstract readonly variant: RouteVariant;

	model?: RouteModel<B, S, P, R> = undefined;

	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	register(): void {
		$registry.router.add(this);
	}

	static resolveAddress<E extends string>(address: RouteAddress<E>): { path: E; method: Method } {
		if (typeof address !== "string") return address;
		if (!address.includes(" ")) return { method: Method.GET, path: address as E };

		const [method, endpoint] = address.split(" ");
		assert(
			arrIncludes(method?.toUpperCase(), Array.from(objGetValues(Method))),
			`Route address cannot include whitespaces unless it starts with an HTTP verb. Received: ${address}`,
		);
		assert(
			endpoint !== undefined,
			`Route address cannot include whitespaces unless it starts with an HTTP verb and ends with a path. Received: ${address}`,
		);
		return { method: method.toUpperCase() as Method, path: endpoint as E };
	}
}

import { type Method } from "@/Request/enums/Method";
import { RouteVariant } from "@/Route/enums/RouteVariant";
import { getRouterInstance } from "@/index";
import { RouteAbstract } from "@/Route/RouteAbstract";
import type { RouteModel } from "@/Model/types/RouteModel";
import type { RouteDefinition } from "@/Route/types/RouteDefinition";
import type { RouteHandler } from "@/Route/types/RouteHandler";
import type { RouteId } from "@/Route/types/RouteId";

/**
 * The object to define an endpoint. Can be instantiated with "new" or inside a controller
 * with {@link ControllerAbstract.route}. The callback recieves the {@link Context} and can
 * return {@link HttpResponse} or any data. Route instantiation automatically registers
 * to the router.
 * */

export class Route<
	Path extends string = string,
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
> extends RouteAbstract<Path, B, S, P, R> {
	constructor(
		definition: RouteDefinition<Path>,
		handler: RouteHandler<B, S, P, R>,
		model?: RouteModel<B, S, P, R>,
	) {
		super();
		this.variant = RouteVariant.dynamic;
		this.endpoint = this.resolveEndpoint(definition, this.variant);
		this.method = this.resolveMethod(definition);
		this.pattern = this.resolvePattern(this.endpoint);
		this.id = this.resolveId(this.method, this.endpoint);
		this.model = model;
		this.handler = handler;

		getRouterInstance().addRoute(this);
		if (model) {
			getRouterInstance().addModel(this.id, model);
		}
	}

	variant: RouteVariant;
	endpoint: Path;
	method: Method;
	pattern: RegExp;
	id: RouteId;
	handler: RouteHandler<B, S, P, R>;
	model?: RouteModel<B, S, P, R> | undefined;

	static makeRouteId(method: string, endpoint: string): RouteId {
		return `[${method.toUpperCase()}]:[${endpoint}]`;
	}
}

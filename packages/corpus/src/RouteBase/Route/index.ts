/**
 * The ordinary route: a method, an endpoint, and a handler.
 *
 * {@link Route} is the {@link RouteVariant.dynamic} member of the
 * {@link RouteBase} family and the one most code uses. The others exist for
 * responses the framework can produce itself — files, directories, socket
 * upgrades — while this one just runs your function.
 *
 * ```ts
 * import { Route } from "@ozanarslan/corpus";
 *
 * new Route("GET /users/:id", (c) => findUser(c.params.id));
 * ```
 *
 * A {@link RouteConfig} adds schemas for the body, search and params, which both
 * validate the request and type {@link Context}, so `c.params.id` is known to be
 * whatever the schema says it is.
 *
 * @module Route
 */

import type { ContextHandler } from "@/Context";
import { Method } from "@/Request";
import {
	resolveRouteAddress,
	RouteBase,
	RouteVariant,
	type RouteAddress,
	type RouteConfig,
} from "@/RouteBase";
import { assert } from "@/utils/assert";

/**
 * A route handled by a function.
 *
 * Constructing one registers it on the nearest {@link App}, which compiles it
 * into the server's route map at {@link App.listen} time along with whatever
 * {@link Middleware} targets it.
 *
 * The type parameters are usually inferred from the {@link RouteConfig} rather
 * than written out, and flow into the {@link Context} the handler receives.
 *
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam R - Response body type.
 * @typeParam E - The literal endpoint type, carried so the endpoint stays
 * narrowly typed at the call site.
 */
class Route<
	B = unknown,
	S = unknown,
	P = unknown,
	R = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, R, E> {
	/**
	 * Creates a route for subclasses, which declare
	 * {@link Route.method}, {@link Route.endpoint} and {@link Route.handler} as
	 * class fields and call {@link RouteBase.register} themselves.
	 */
	constructor();
	/**
	 * Creates a route and registers it on the nearest {@link App}.
	 *
	 * @param address - The {@link RouteAddress}: a `"METHOD /endpoint"` string or a
	 * method-and-endpoint pair.
	 * @param callback - The {@link ContextHandler} that answers the request.
	 * @param model - Optional {@link RouteConfig} declaring validation schemas and
	 * per-route limits. Its schemas also type the {@link Context} the handler
	 * receives.
	 */
	constructor(
		address: RouteAddress<E>,
		callback: ContextHandler<B, S, P, R>,
		model?: RouteConfig<B, S, P, R>,
	);
	constructor(
		address?: RouteAddress<E>,
		callback?: ContextHandler<B, S, P, R>,
		model?: RouteConfig<B, S, P, R>,
	) {
		super();
		if (new.target !== Route) return;
		assert.present(address, "address is required when Route is constructed directly.");
		assert.present(callback, "callback is required when Route is constructed directly.");
		const addr = resolveRouteAddress(address);
		this.method = addr.method;
		this.endpoint = addr.endpoint;
		this.config = model;
		this.handler = callback;
		this.register();
	}

	/** Marks this route as {@link RouteVariant.dynamic} for {@link App} route compilation. */
	readonly variant: RouteVariant = RouteVariant.dynamic;

	/** The {@link Method} this route answers, taken from the {@link RouteAddress}. */
	readonly method!: Method;

	/**
	 * The path this route answers. Supports `:name` parameters and a trailing
	 * wildcard, both of which arrive in {@link Context.params}.
	 */
	readonly endpoint!: E;

	/**
	 * Validation schemas and per-route limits. Absent means nothing is validated —
	 * and, since {@link getContextAccess} inspects it, absent schemas are one of
	 * the signals that a surface need not be parsed at all.
	 */
	readonly config?: RouteConfig<B, S, P, R> = undefined;

	/**
	 * The function that answers the request.
	 *
	 * Return a value to send it as the body, a {@link Res} to control the whole
	 * response, or nothing after mutating {@link Context.res} directly.
	 */
	override handler!: ContextHandler<B, S, P, R>;
}

export { Route };

/**
 * Logic that runs around a route handler — before it, after it, or instead of
 * it.
 *
 * A {@link Middleware} receives the {@link Context} and a `next` function. What
 * runs before `await next()` happens on the way in; what runs after it happens
 * on the way out, with the downstream result in hand. Returning early instead of
 * calling `next()` short-circuits the chain, which is how authentication rejects
 * a request without the route handler ever running.
 *
 * Constructing one registers it on the nearest {@link App}, which folds it into
 * each targeted route's chain at compile time via {@link composeHandlerChain}.
 * Targeting is by route id, but {@link Middleware.useOn} accepts routes and
 * {@link Controller} instances directly and resolves the ids itself.
 *
 * ```ts
 * import { Middleware } from "@ozanarslan/corpus";
 *
 * new Middleware({
 *   useOn: usersController,
 *   handler: async (c, next) => {
 *     const started = performance.now();
 *     const result = await next();
 *     c.res.headers.set("X-Response-Time", performance.now() - started);
 *     return result;
 *   },
 * });
 * ```
 *
 * @module Middleware
 */

import type { Context } from "@/Context";
import type { Controller } from "@/Controller";
import { getNearestApp } from "@/Globals/AppsRegistry";
import type { RouteBase } from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isString, type OrString } from "@/utils/lexical";
import type { MaybePromise } from "@/utils/maybe";

/**
 * A middleware's handler function. Like a {@link ContextHandler}, but with the
 * rest of the chain passed in.
 *
 * What the return value means is resolved by {@link composeHandlerChain}: a
 * returned value short-circuits the chain, `undefined` after calling `next()`
 * passes the downstream result through, and `undefined` without calling `next()`
 * lets the chain continue anyway.
 *
 * @param context - The {@link Context} for the request, shared with every other
 * handler in the chain. Use {@link Context.data} to pass state downstream.
 * @param next - Runs the rest of the chain and resolves to its result. Calling
 * it more than once throws.
 * @returns The response value, or `undefined` to defer to the chain.
 * @typeParam R - The result type passed along the chain.
 */
type MiddlewareHandler<R = unknown> = (
	context: Context,
	next: () => MaybePromise<R>,
) => MaybePromise<R>;

/**
 * What a middleware applies to.
 *
 * A {@link RouteBase} targets that route, a {@link Controller} targets every
 * route registered through it, a string targets a route id directly, and an
 * array combines any of these. The literal `"*"` targets every route on the app,
 * including requests that match none — global middlewares also run ahead of
 * {@link App.handleNotFound}.
 */
type MiddlewareUseOn =
	| Array<RouteBase | Controller | string>
	| RouteBase
	| Controller
	| OrString<"*">;

/** Construction arguments for a {@link Middleware}. */
type MiddlewareDefinition = {
	/** What the middleware applies to. Defaults to `"*"` — every route. */
	useOn?: MiddlewareUseOn;
	/** The {@link MiddlewareHandler} to run. */
	handler: MiddlewareHandler;
};

/**
 * A handler registered to run around some or all of an app's routes.
 *
 * Middlewares execute in the order {@link App.findMiddlewares} returns them:
 * global ones first, then route-specific ones, then the route handler. Since the
 * chain nests, a global middleware wraps everything after it — its post-`next()`
 * code runs last.
 *
 * Targeting a route id that no route claims is not an error, but the middleware
 * will never run; {@link App.warnUnmatchedMiddlewares} logs a warning at startup
 * when that happens.
 */
class Middleware {
	/**
	 * Creates a middleware for subclasses, which declare
	 * {@link Middleware.handler} and {@link Middleware.useOn} as class fields and
	 * call {@link Middleware.register} themselves.
	 */
	constructor();
	/**
	 * Creates a middleware and registers it on the nearest {@link App}.
	 *
	 * @param definition - The {@link MiddlewareDefinition}: the handler, and
	 * optionally what it applies to.
	 */
	constructor(definition: MiddlewareDefinition);
	constructor(definition?: MiddlewareDefinition) {
		if (new.target !== Middleware) return;
		assertDefined(definition, "definition is required when Middleware is constructed directly.");
		this.useOn = definition.useOn ?? "*";
		this.handler = definition.handler;
		this.register();
	}

	/**
	 * Registers this middleware on the nearest {@link App} through
	 * {@link App.addMiddleware}. Called by the constructor.
	 *
	 * Registration order relative to routes does not matter — targets are resolved
	 * to ids here, and the app only matches them when it compiles routes.
	 */
	register(): void {
		getNearestApp().addMiddleware(this);
	}

	/**
	 * What this middleware applies to. Defaults to `"*"`, meaning every route on
	 * the app.
	 */
	useOn: MiddlewareUseOn = "*";

	/** The function that runs when a targeted route is hit. */
	handler!: MiddlewareHandler;

	/**
	 * The route ids resolved from {@link Middleware.useOn}, which
	 * {@link App.addMiddleware} indexes the middleware under.
	 *
	 * Each target contributes its ids: a route its own, a {@link Controller} all
	 * of {@link Controller.routeIds}, and a string itself. Duplicates are
	 * collapsed, so a route listed both directly and through its controller is
	 * still wrapped once.
	 *
	 * @returns The ids, or `["*"]` for a global middleware.
	 */
	get routeIds(): Array<string> {
		if (this.useOn === "*") return ["*"];
		const targets = Array.isArray(this.useOn) ? this.useOn : [this.useOn];
		const routeIds = new Set<string>();
		for (const target of targets) {
			if (isString(target)) {
				routeIds.add(target);
			} else if ("id" in target) {
				routeIds.add(target.id);
			} else {
				target.routeIds.forEach((id) => routeIds.add(id));
			}
		}
		return Array.from(routeIds);
	}
}

export { Middleware, type MiddlewareDefinition, type MiddlewareUseOn, type MiddlewareHandler };

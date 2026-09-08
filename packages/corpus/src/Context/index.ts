/**
 * The per-request object every handler receives.
 *
 * A {@link Context} carries the incoming request alongside the parsed views of
 * it — {@link Context.body}, {@link Context.params}, {@link Context.search} —
 * and the {@link Res} being built up in reply. It is created once per request by
 * the {@link ContextFactory} on {@link App.contextFactory} and threaded through
 * the whole {@link Middleware} chain, so it is also the place to hang state that
 * one handler produces and another consumes.
 *
 * The parsed fields start out empty and are filled by {@link App} during the
 * request lifecycle, but only for the surfaces a route's handlers actually read
 * — {@link getContextAccess} decides that, so an untouched body is never parsed.
 *
 * @module Context
 */

import { Res } from "@/Res";
import type { Server } from "@/Server";
import type { Maybe, MaybePromise } from "@/utils/maybe";
import { createSafeObject } from "@/utils/object";
import { lazy, type Lazy, type LazyMut } from "@/utils/variable";

/**
 * Declaration target for {@link Context.data}, the request-scoped state shared
 * between {@link Middleware} and route handlers.
 *
 * Empty by design. Augment it from your own code so everything a middleware sets
 * is typed where a handler reads it:
 *
 * ```ts
 * declare module "@ozanarslan/corpus" {
 *   interface ContextDataInterface {
 *     user: User;
 *   }
 * }
 * ```
 */
interface ContextDataInterface {}

/**
 * Builds the {@link Context} for an incoming request. Assigned to
 * {@link App.contextFactory}; replace it to have an app construct a
 * {@link Context} subclass.
 *
 * @param request - The incoming request.
 * @param server - The {@link Server} that accepted it, absent when the request
 * was dispatched without one.
 * @returns The context the request will be handled with.
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam R - Response body type carried by {@link Context.res}.
 */
type ContextFactory<B = unknown, S = unknown, P = unknown, R = unknown> = (
	request: Request,
	server: Maybe<Server>,
) => Context<B, S, P, R>;

/**
 * A function that handles a request given its {@link Context}. This is the shape
 * of a {@link RouteBase} handler and of the app-level hooks
 * {@link App.handleNotFound} and {@link App.handlePreflight}.
 *
 * A {@link Middleware} handler is a {@link MiddlewareHandler} instead, since it
 * additionally receives `next`.
 *
 * @param context - The {@link Context} for the request.
 * @returns The response body, a {@link Res}, or a promise of either. Returning
 * `undefined` leaves {@link Context.res} as the handler mutated it.
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam R - Response body type.
 */
type ContextHandler<B = unknown, S = unknown, P = unknown, R = unknown> = (
	context: Context<B, S, P, R>,
) => MaybePromise<R>;

/**
 * Everything a handler needs to know about one request, and everything it uses
 * to answer it.
 *
 * The type parameters are supplied by the route the context belongs to, so a
 * handler sees its own validated shapes rather than `unknown`.
 *
 * {@link Context.res} and {@link Context.url} are lazy: neither the response
 * object nor the parsed URL is constructed until something reads it, so a
 * handler that returns a body without touching either pays for neither.
 *
 * The parsed containers are created with {@link createSafeObject}, so a payload
 * carrying a `__proto__` key cannot reach `Object.prototype` through them.
 *
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam R - Response body type carried by {@link Context.res}.
 */
class Context<B = unknown, S = unknown, P = unknown, R = unknown> {
	/**
	 * Creates a context with empty parsed containers; {@link App} fills them
	 * during the request lifecycle.
	 *
	 * @param req - The incoming request.
	 * @param server - The {@link Server} that accepted it. Absent when the request
	 * was dispatched without one, which is why {@link Context.server} is optional
	 * at every use site — including the WebSocket upgrade.
	 */
	constructor(req: Request, server: Maybe<Server>) {
		this.req = req;
		this.server = server;
		this._res = lazy.mut(() => new Res<R>());
		this._url = lazy(() => new URL(this.req.url));
		this.body = createSafeObject<B>();
		this.params = createSafeObject<P>();
		this.search = createSafeObject<S>();
		this.data = createSafeObject<ContextDataInterface>();
	}

	/**
	 * The parsed request body, decoded by {@link BodyParser} and validated against
	 * the route's {@link RouteConfig} body schema.
	 *
	 * Empty for {@link Method.GET} and {@link Method.HEAD} requests, and for any
	 * route whose handlers never read it.
	 */
	body: B;

	/**
	 * The path parameters matched by the route, parsed by
	 * {@link ParsersRegistry.urlParamsParser} and validated against the route's
	 * params schema. A wildcard segment is available under the `*` key.
	 */
	params: P;

	/**
	 * The query string, parsed by {@link ParsersRegistry.searchParamsParser} and
	 * validated against the route's search schema. Empty when the request carried
	 * no query string.
	 */
	search: S;

	/**
	 * Free-form request-scoped state, shared across the whole
	 * {@link Middleware} chain and the route handler. This is how a middleware
	 * hands something — an authenticated user, a request id — to what runs after
	 * it. Type it by augmenting {@link ContextDataInterface}.
	 */
	data: ContextDataInterface;

	/**
	 * The {@link Server} that accepted the request. Needed to upgrade a connection
	 * to a {@link WebSocketRoute}; absent when the request was dispatched without
	 * a server.
	 */
	readonly server: Maybe<Server>;

	/**
	 * The untouched incoming request. Read it for headers and for the raw body;
	 * the parsed views live on {@link Context.body} and its siblings.
	 */
	readonly req: Request;

	/** Backing store for {@link Context.res}, constructed on first access. */
	private _res: LazyMut<Res<R>>;

	/**
	 * The response under construction. Mutate it to set status, headers or body
	 * before returning, or assign a whole new {@link Res} to replace it.
	 *
	 * A {@link Middleware} that replaces this after `next()` resolves wins over
	 * whatever the downstream handler returned — see {@link composeHandlerChain}.
	 *
	 * @returns The response object, created on first access.
	 */
	get res(): Res<R> {
		return this._res();
	}

	set res(value: Res<R>) {
		this._res.set(value);
	}

	/** Backing store for {@link Context.url}, parsed on first access. */
	private _url: Lazy<URL>;

	/**
	 * The request URL, parsed once and reused.
	 *
	 * @returns The parsed `URL`. Prefer {@link Context.params} and
	 * {@link Context.search} for path and query values; reach for this when you
	 * need the pathname or origin itself, as {@link BundleRoute} does.
	 */
	get url(): URL {
		return this._url();
	}
}

export { Context, type ContextDataInterface, type ContextFactory, type ContextHandler };

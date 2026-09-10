/**
 * The base every route kind extends, and the address and config types they
 * share.
 *
 * {@link RouteBase} defines what {@link App} needs from a route to compile it —
 * a {@link RouteVariant}, a {@link Method}, an endpoint, an optional
 * {@link RouteConfig}, and a handler — plus registration and the direct-call
 * helpers. The concrete kinds are {@link Route}, {@link StaticRoute},
 * {@link FileRoute}, {@link BundleRoute} and {@link WebSocketRoute}; extend this
 * class only to add a kind of your own.
 *
 * {@link RouteBase.handle} is worth knowing about even if you never subclass:
 * it invokes a route's handler directly, without a server, which is how routes
 * are unit tested and how one route can call another in process.
 *
 * @module RouteBase
 */

import { Context, type ContextHandler } from "@/Context";
import { getNearestApp } from "@/Globals/AppsRegistry";
import { HeaderKey } from "@/Headers";
import type { Schema } from "@/ParserBase/SchemaParser";
import { Method } from "@/Request";
import { assert } from "@/utils/assert";
import { isObject, isOneOf, type MaybePromise } from "@/utils/is";
import type { ValueOf } from "@/utils/object";
import { joinPathSegments } from "@/utils/path";

/**
 * What kind of route this is. {@link App.composeRoutes} branches on it — a
 * `websocket` route upgrades instead of responding, and a `bundle` route is
 * excluded from {@link RateLimiter} by default.
 */
const RouteVariant = {
	/** A file whose contents feed a handler. See {@link StaticRoute}. */
	static: "static",
	/** A single file served as-is. See {@link FileRoute}. */
	file: "file",
	/** A handler function. See {@link Route}. */
	dynamic: "dynamic",
	/** A connection upgrade. See {@link WebSocketRoute}. */
	websocket: "websocket",
	/** A directory of built files. See {@link BundleRoute}. */
	bundle: "bundle",
} as const;

/** One of the {@link RouteVariant} values. */
type RouteVariant = ValueOf<typeof RouteVariant>;

/**
 * The request to simulate when calling a route directly through
 * {@link RouteBase.handle}. Every field is optional — supply only what the
 * handler reads.
 *
 * @typeParam B - Body type.
 * @typeParam S - Search type.
 * @typeParam P - Params type.
 */
type RouteHandleInput<B, S, P> = {
	/** The request body, already in parsed form. */
	body?: B;
	/** The query values, already in parsed form. */
	search?: S;
	/** The path parameters, which are also substituted into the endpoint. */
	params?: P;
	/** Headers for the synthesized request. */
	headers?: HeadersInit;
};

/**
 * A route's schemas and per-route limits.
 *
 * The schemas do double duty: {@link SchemaParser} validates against them at
 * request time, and their inferred output types become the {@link Context}
 * types the handler sees. {@link getContextAccess} also reads this to decide
 * what to parse — a surface with a schema is always parsed, since it must be
 * validated.
 *
 * @typeParam B - Body type.
 * @typeParam S - Search type.
 * @typeParam P - Params type.
 * @typeParam R - Response type.
 */
type RouteConfig<B = unknown, S = unknown, P = unknown, R = unknown> = {
	/**
	 * Body size ceiling in bytes for this route, enforced by
	 * {@link enforceBodyLimit}. Tightens {@link App.maxRequestBodySize} for a
	 * single endpoint — an upload route and a JSON route rarely want the same
	 * limit.
	 */
	maxRequestBodySize?: number;
	/** Schema for the response body. Types the handler's return value. */
	response?: Schema<R>;
	/** Schema for the request body. Validated before the handler runs. */
	body?: Schema<B>;
	/** Schema for the query string. Validated before the handler runs. */
	search?: Schema<S>;
	/** Schema for the path parameters. Validated before the handler runs. */
	params?: Schema<P>;
};

/**
 * Where a route lives, in any of the forms the constructors accept.
 *
 * A bare path means {@link Method.GET}. A `"METHOD /path"` string is the usual
 * form, and the verb may be written in either case. The object form is what
 * {@link resolveRouteAddress} normalizes everything into, and what
 * {@link Controller} passes through once it has joined its prefix on.
 *
 * @typeParam E - The literal endpoint type.
 */
type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| `${Lowercase<Method>} ${E}`
	| { method: Method; endpoint: E };

/**
 * Normalizes any {@link RouteAddress} form into a method and an endpoint.
 *
 * The space in `"POST /users"` is what separates the verb from the path, so a
 * string containing a space must start with a valid verb — otherwise it is a
 * malformed address rather than a path that happens to contain a space, and it
 * is rejected loudly at registration time instead of quietly never matching.
 *
 * @param address - The address to resolve, in any accepted form.
 * @returns The endpoint and its {@link Method}, with the verb uppercased.
 * @throws {@link Error} when a string contains a space but does not begin with
 * an HTTP verb followed by a path.
 */
function resolveRouteAddress<E extends string>(
	address: RouteAddress<E>,
): { endpoint: E; method: Method } {
	if (typeof address !== "string") return address;
	if (!address.includes(" ")) return { method: Method.GET, endpoint: address as E };

	const [method, endpoint] = address.split(" ");
	assert(
		isOneOf(method?.toUpperCase(), Object.values(Method)),
		`Route address cannot include whitespaces unless it starts with an HTTP verb. Received: ${address}`,
	);
	assert(
		typeof endpoint === "string" && endpoint.trim() !== "",
		`Route address cannot include whitespaces unless it starts with an HTTP verb and ends with a path. Received: ${address}`,
	);
	return { method: method.toUpperCase() as Method, endpoint: endpoint as E };
}

/**
 * The contract every route kind implements.
 *
 * Subclasses declare what they are and how they answer; this class supplies
 * {@link RouteBase.id}, registration, and the direct-invocation helpers.
 *
 * The abstract members exist because {@link App} reads them while compiling —
 * {@link RouteBase.variant} decides the pipeline shape,
 * {@link RouteBase.config} decides what gets parsed and validated, and the rest
 * decide where the route sits in the route map.
 *
 * @typeParam B - Parsed {@link Context.body} type.
 * @typeParam S - Parsed {@link Context.search} type.
 * @typeParam P - Parsed {@link Context.params} type.
 * @typeParam R - Response body type.
 * @typeParam E - The literal endpoint type.
 */
abstract class RouteBase<B = any, S = any, P = any, R = any, E extends string = string> {
	/** Which kind of route this is. */
	abstract readonly variant: RouteVariant;

	/** The HTTP method this route answers. */
	abstract readonly method: Method;

	/** The path this route answers, before {@link App.prefix} is applied. */
	abstract readonly endpoint: E;

	/** Schemas and limits for this route, if any. */
	abstract readonly config?: RouteConfig<B, S, P, R>;

	// Has to be a method to circumvent any/never typescript errors
	/**
	 * Answers the request. Declared as a method rather than a property so
	 * subclasses can narrow its parameter types — a property declaration would
	 * make the variance error out on routes that take `never` for their inputs.
	 *
	 * @param args - The {@link ContextHandler} arguments: the {@link Context} for
	 * the request.
	 * @returns The response body, a {@link Res}, or nothing.
	 */
	abstract handler(
		...args: Parameters<ContextHandler<B, S, P, R>>
	): ReturnType<ContextHandler<B, S, P, R>>;

	/**
	 * The route's identity, as `"METHOD /endpoint"`.
	 *
	 * This is what {@link Middleware.useOn} targets and what
	 * {@link Controller.routeIds} collects, so two routes sharing a method and
	 * endpoint share middlewares as well.
	 *
	 * @returns The id.
	 */
	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	/**
	 * Appends this route to the nearest {@link App}. Called by every concrete
	 * route's constructor; a subclass that declares its members as class fields
	 * must call it itself, after those fields are initialized.
	 */
	register() {
		getNearestApp().routes.push(this);
	}

	/**
	 * Invokes the route's handler directly, with no server and no HTTP.
	 *
	 * The inputs are taken as already-parsed values, so nothing is decoded or
	 * validated — and no {@link Middleware} runs, since middlewares are folded in
	 * by {@link App} at compile time, not by the route. What this exercises is the
	 * handler itself, which is what makes it useful for unit tests and for calling
	 * one route's logic from another.
	 *
	 * @param data - The {@link RouteHandleInput} to build the {@link Context}
	 * from.
	 * @returns Whatever the handler returns.
	 */
	handle(data: RouteHandleInput<B, S, P>): MaybePromise<R> {
		const context = new Context<B, S, P, R>(this.request(data), null);

		if (isObject(data.body)) context.body = data.body;
		if (isObject(data.params)) context.params = data.params;
		if (isObject(data.search)) context.search = data.search;

		return this.handler(context);
	}

	/**
	 * Builds the request a {@link RouteHandleInput} describes, so the
	 * {@link Context} that {@link RouteBase.handle} creates has a real request
	 * behind it — a handler reading {@link Context.url} or a header gets what it
	 * would have got over the wire.
	 *
	 * Params are substituted into the endpoint, so `/users/:id` becomes a concrete
	 * URL. A `FormData` body is passed through untouched, since the runtime sets
	 * its own multipart content type with the boundary; anything else is
	 * JSON-encoded.
	 *
	 * @param data - The {@link RouteHandleInput} to build from.
	 * @returns The synthesized request, addressed against {@link App.baseUrl}.
	 */
	request(data: RouteHandleInput<B, S, P>): Request {
		const app = getNearestApp();
		let endpoint = joinPathSegments(app.prefix, this.endpoint);

		if (isObject(data.params)) {
			for (const [key, value] of Object.entries(data.params)) {
				endpoint = endpoint.replace(`:${String(key)}`, String(value));
			}
		}

		const url = new URL(endpoint, app.baseUrl);

		if (isObject(data.search)) {
			for (const [key, value] of Object.entries(data.search)) {
				url.searchParams.set(String(key), String(value));
			}
		}

		const headers = new Headers(data.headers);

		let body: BodyInit | undefined = undefined;

		if (data.body instanceof FormData) {
			body = data.body;
		} else if (isObject(data.body)) {
			body = JSON.stringify(data.body);
			headers.set(HeaderKey.ContentType, "application/json");
		}

		return new Request(url, { method: this.method, body, headers });
	}
}

export { RouteBase, RouteVariant, type RouteConfig, type RouteAddress, resolveRouteAddress };

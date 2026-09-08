/**
 * WebSocket endpoints.
 *
 * {@link WebSocketRoute} is the {@link RouteVariant.websocket} member of the
 * {@link RouteBase} family. It is the one route kind that does not produce a
 * response: {@link App.composeRoutes} sees the variant and upgrades the
 * connection instead, storing the route itself as the socket's data so that
 * every later event can be dispatched back to its callbacks.
 *
 * ```ts
 * import { WebSocketRoute } from "@ozanarslan/corpus";
 *
 * new WebSocketRoute("/chat", {
 *   onOpen: (ws) => ws.subscribe("room"),
 *   onMessage: (ws, message) => ws.publish("room", message),
 * });
 * ```
 *
 * Since one route instance backs every connection to that endpoint, per-socket
 * state belongs on the socket — through Bun's `subscribe`/`publish` or a map
 * keyed by socket — not on the route.
 *
 * @module WebSocketRoute
 */

import type { ContextHandler } from "@/Context";
import { Method } from "@/Request";
import { RouteBase, RouteVariant, type RouteConfig } from "@/RouteBase";
import type { ServerWebSocket } from "@/Server";
import { assertDefined } from "@/utils/assert";
import type { MaybePromise } from "@/utils/maybe";

/**
 * Runs once a connection has been upgraded and is ready.
 *
 * @param ws - The newly opened {@link ServerWebSocket}.
 */
type WebSocketOnOpen = (ws: ServerWebSocket) => MaybePromise<void>;

/**
 * Runs when a connection closes, whichever side ended it.
 *
 * @param ws - The closing {@link ServerWebSocket}.
 * @param code - The WebSocket close code, when one was sent.
 * @param reason - The accompanying reason, when one was sent.
 */
type WebSocketOnClose = (ws: ServerWebSocket, code?: number, reason?: string) => MaybePromise<void>;

/**
 * Runs for each message a client sends.
 *
 * @param ws - The {@link ServerWebSocket} the message arrived on.
 * @param message - The payload: a string for text frames, a `Buffer` for binary
 * ones.
 */
type WebSocketOnMessage = (ws: ServerWebSocket, message: string | Buffer) => MaybePromise<void>;

/** The socket lifecycle callbacks a {@link WebSocketRoute} is built from. */
interface WebSocketRouteDefinition {
	// TODO: onBeforeUpgrade
	/** Called once per connection, after the upgrade succeeds. */
	onOpen?: WebSocketOnOpen;
	/** Called once per connection, when it closes. */
	onClose?: WebSocketOnClose;
	/** Called for every message received. The only required callback — a socket that never reads has nothing to do. */
	onMessage: WebSocketOnMessage;
}

/**
 * A WebSocket endpoint.
 *
 * Constructing one registers it on the nearest {@link App}, which upgrades
 * matching requests rather than responding to them. The callbacks are shared by
 * every connection to the endpoint, and each event receives the socket it
 * concerns.
 *
 * @typeParam E - The literal endpoint type, carried so the endpoint stays
 * narrowly typed at the call site.
 */
class WebSocketRoute<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	WebSocketRoute,
	E
> {
	/**
	 * Creates a websocket route for subclasses, which declare
	 * {@link WebSocketRoute.endpoint} and the callbacks as class fields and call
	 * {@link RouteBase.register} themselves.
	 */
	constructor();
	/**
	 * Creates a websocket route and registers it on the nearest {@link App}.
	 *
	 * @param endpoint - The path clients connect to.
	 * @param definition - The {@link WebSocketRouteDefinition} holding the socket
	 * lifecycle callbacks.
	 */
	constructor(endpoint: E, definition: WebSocketRouteDefinition);
	constructor(endpoint?: E, definition?: WebSocketRouteDefinition) {
		super();
		if (new.target !== WebSocketRoute) return;
		const msg = "WebSocketRoute must be constructed with (path, definition) or extended.";
		assertDefined(endpoint, msg);
		assertDefined(definition, msg);
		this.endpoint = endpoint;
		this.onOpen = definition.onOpen;
		this.onClose = definition.onClose;
		this.onMessage = definition.onMessage;
		this.register();
	}

	/**
	 * Marks this route as {@link RouteVariant.websocket}, which is what tells
	 * {@link App.composeRoutes} to upgrade rather than respond.
	 */
	override readonly variant: RouteVariant = RouteVariant.websocket;

	/** Always {@link Method.GET} — an upgrade handshake is a GET request. */
	override readonly method: Method = Method.GET;

	/** The path clients connect to. */
	override endpoint!: E;

	/** No schemas apply: an upgrade request carries no body, search or params to validate. */
	override readonly config?: RouteConfig<never, never, never, WebSocketRoute<string>> | undefined =
		undefined;

	// TODO: upgrade here
	/**
	 * Returns the route itself, which {@link App.composeRoutes} attaches to the
	 * socket as its data — that is how a message arriving minutes later finds its
	 * way back to {@link WebSocketRoute.onMessage}.
	 *
	 * The upgrade itself still happens in {@link App}; this handler only supplies
	 * what the socket carries.
	 *
	 * @returns This route.
	 */
	override readonly handler: ContextHandler<never, never, never, WebSocketRoute<string>> = () =>
		this;

	/** Called once per connection, after the upgrade succeeds. */
	onOpen?: WebSocketOnOpen | undefined;

	/** Called once per connection, when it closes. */
	onClose?: WebSocketOnClose | undefined;

	/** Called for every message received. */
	onMessage!: WebSocketOnMessage;
}

export {
	WebSocketRoute,
	type WebSocketOnMessage,
	type WebSocketOnClose,
	type WebSocketOnOpen,
	type WebSocketRouteDefinition,
};

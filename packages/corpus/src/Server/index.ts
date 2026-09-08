/**
 * Type aliases for Bun's server primitives, parameterized for corpus.
 *
 * Bun's server and socket types take the per-connection data type as a
 * parameter. Corpus always stores a {@link WebSocketRoute} there — that is how a
 * live socket knows which route's callbacks to invoke — so these aliases pin it
 * once instead of at every use site.
 *
 * Nothing here is a runtime construct; these are the shapes {@link App} builds
 * and hands to `Bun.serve`.
 *
 * @module Server
 */

import type { Method } from "@/Request";
import type { Maybe, Optional, MaybePromise } from "@/utils/maybe";
import type { WebSocketRoute } from "@/WebSocketRoute";

/**
 * A live WebSocket connection. Its `data` is the {@link WebSocketRoute} that
 * accepted the upgrade, which is what {@link App.createServer} dispatches the
 * open, message and close events through.
 */
type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;

/** The running Bun server, as held by {@link App.server}. */
type Server = Bun.Server<WebSocketRoute>;

/**
 * A compiled request handler, as produced by {@link App.finalize}.
 *
 * This is the form both a route map entry and the `fetch` fallback take. The
 * response is optional because a {@link WebSocketRoute} upgrades the connection
 * instead of responding.
 *
 * @param request - The incoming request.
 * @param server - The {@link Server} that accepted it.
 * @returns The response, or nothing when the connection was upgraded.
 */
type ServerHandler = (request: Request, server: Maybe<Server>) => MaybePromise<Optional<Response>>;

/**
 * The route table handed to `Bun.serve`, keyed by endpoint and then by
 * {@link Method}. Built by {@link App.composeRoutes}; anything it does not match
 * falls through to {@link App.composeFetch}.
 */
type ServerRouteMap = Record<string, Partial<Record<Method, ServerHandler>>>;

export type { Server, ServerHandler, ServerRouteMap, ServerWebSocket };

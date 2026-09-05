import type { Method } from "@/Request";
import type { Maybe, Optional, MaybePromise } from "@/utils/maybe";
import type { WebSocketRoute } from "@/WebSocketRoute";

type ServerWebSocket = Bun.ServerWebSocket<WebSocketRoute>;
type ServerWebSocketHandler = Bun.WebSocketHandler<WebSocketRoute>;

type Server = Bun.Server<WebSocketRoute>;

type ServerHandler = (request: Request, server: Maybe<Server>) => MaybePromise<Optional<Response>>;

type ServerRouteMap = Record<string, Partial<Record<Method, ServerHandler>>>;

export type { Server, ServerHandler, ServerRouteMap, ServerWebSocketHandler, ServerWebSocket };

import type { Func } from "@/utils";

import type { ServerWebSocket } from "@/C/Server/Server.types";

export type WebSocketOnOpen = Func<[ws: ServerWebSocket], Bun.MaybePromise<void>>;
export type WebSocketOnClose = Func<
	[ws: ServerWebSocket, code?: number, reason?: string],
	Bun.MaybePromise<void>
>;
export type WebSocketOnMessage = Func<
	[ws: ServerWebSocket, message: string | Buffer],
	Bun.MaybePromise<void>
>;

export type WebSocketRouteDefinition = {
	onOpen?: WebSocketOnOpen;
	onClose?: WebSocketOnClose;
	onMessage: WebSocketOnMessage;
};

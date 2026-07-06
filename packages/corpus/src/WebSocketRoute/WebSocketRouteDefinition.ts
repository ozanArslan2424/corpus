import type { Func } from "@/utils/functions";

import type { ServerWebSocket } from "@/Server/ServerWebSocket";

export type WebSocketRouteDefinition = {
	onOpen?: Func<[ws: ServerWebSocket], Bun.MaybePromise<void>>;
	onClose?: Func<[ws: ServerWebSocket, code?: number, reason?: string], Bun.MaybePromise<void>>;
	onMessage: Func<[ws: ServerWebSocket, message: string | Buffer], Bun.MaybePromise<void>>;
};

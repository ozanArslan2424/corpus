import type { ContextHandler } from "@/Context";
import { Method } from "@/Request";
import { RouteBase, RouteVariant, type RouteConfig } from "@/RouteBase";
import type { ServerWebSocket } from "@/Server";
import { assertDefined } from "@/utils/assert";
import type { MaybePromise } from "@/utils/maybe";

type WebSocketOnOpen = (ws: ServerWebSocket) => MaybePromise<void>;

type WebSocketOnClose = (ws: ServerWebSocket, code?: number, reason?: string) => MaybePromise<void>;

type WebSocketOnMessage = (ws: ServerWebSocket, message: string | Buffer) => MaybePromise<void>;

interface WebSocketRouteDefinition {
	// TODO: onBeforeUpgrade
	onOpen?: WebSocketOnOpen;
	onClose?: WebSocketOnClose;
	onMessage: WebSocketOnMessage;
}

class WebSocketRoute<E extends string = string> extends RouteBase<
	never,
	never,
	never,
	WebSocketRoute,
	E
> {
	constructor();
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

	override readonly variant: RouteVariant = RouteVariant.websocket;
	override readonly method: Method = Method.GET;
	override endpoint!: E;
	override readonly config?: RouteConfig<never, never, never, WebSocketRoute<string>> | undefined =
		undefined;
	// TODO: upgrade here
	override readonly handler: ContextHandler<never, never, never, WebSocketRoute<string>> = () =>
		this;

	onOpen?: WebSocketOnOpen | undefined;
	onClose?: WebSocketOnClose | undefined;
	onMessage!: WebSocketOnMessage;
}

export type { WebSocketOnMessage, WebSocketOnClose, WebSocketOnOpen, WebSocketRouteDefinition };
export { WebSocketRoute };

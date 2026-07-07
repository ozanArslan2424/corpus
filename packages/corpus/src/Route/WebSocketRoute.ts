import type { WebSocketRouteDefinition } from "@/Route/types";
import { WebSocketRouteAbstract } from "@/Route/WebSocketRouteAbstract";

export class WebSocketRoute<E extends string = string> extends WebSocketRouteAbstract<E> {
	constructor(path: E, callbacks: WebSocketRouteDefinition) {
		super();
		this.endpoint = path;
		this.onOpen = callbacks.onOpen;
		this.onClose = callbacks.onClose;
		this.onMessage = callbacks.onMessage;
		this.register();
	}

	readonly onOpen?: WebSocketRouteDefinition["onOpen"];

	readonly onClose?: WebSocketRouteDefinition["onClose"];

	readonly onMessage: WebSocketRouteDefinition["onMessage"];

	override endpoint: string;
}

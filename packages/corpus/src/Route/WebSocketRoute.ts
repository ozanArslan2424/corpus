import type { WebSocketRouteCallbacks } from "@/Route/types";
import { WebSocketRouteAbstract } from "@/Route/WebSocketRouteAbstract";

export class WebSocketRoute<E extends string = string> extends WebSocketRouteAbstract<E> {
	constructor(path: E, callbacks: WebSocketRouteCallbacks) {
		super();
		this.endpoint = path;
		this.onOpen = callbacks.onOpen;
		this.onClose = callbacks.onClose;
		this.onMessage = callbacks.onMessage;
		this.register();
	}

	readonly onOpen?: WebSocketRouteCallbacks["onOpen"];

	readonly onClose?: WebSocketRouteCallbacks["onClose"];

	readonly onMessage: WebSocketRouteCallbacks["onMessage"];

	override endpoint: string;
}

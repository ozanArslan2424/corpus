import { WebSocketRouteAbstract } from "@/C/WebSocketRoute/WebSocketRoute.abstract";
import type {
	WebSocketOnClose,
	WebSocketOnMessage,
	WebSocketOnOpen,
	WebSocketRouteDefinition,
} from "@/C/WebSocketRoute/WebSocketRoute.types";

export class WebSocketRoute<E extends string = string> extends WebSocketRouteAbstract<E> {
	constructor(path: E, definition: WebSocketRouteDefinition) {
		super();
		this.endpoint = path;
		this.onOpen = definition.onOpen;
		this.onClose = definition.onClose;
		this.onMessage = definition.onMessage;
		this.register();
	}

	override onOpen?: WebSocketOnOpen | undefined;

	override onClose?: WebSocketOnClose | undefined;

	override onMessage: WebSocketOnMessage;

	override endpoint: E;
}

import type { Func } from "@ozanarslan/utils";

import type { Context } from "@/C/Context/Context";
import { Method } from "@/C/Method/Method";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import { RouteVariant } from "@/C/RouteBase/RouteBase.types";
import type {
	WebSocketOnClose,
	WebSocketOnMessage,
	WebSocketOnOpen,
} from "@/C/WebSocketRoute/WebSocketRoute.types";

export abstract class WebSocketRouteAbstract<E extends string = string> extends RouteBase<E> {
	abstract readonly onOpen?: WebSocketOnOpen;

	abstract readonly onClose?: WebSocketOnClose;

	abstract readonly onMessage: WebSocketOnMessage;

	override readonly variant: RouteVariant = RouteVariant.websocket;

	override method: Method = Method.GET;

	get handler(): Func<[Context], WebSocketRouteAbstract> {
		return () => this;
	}
}

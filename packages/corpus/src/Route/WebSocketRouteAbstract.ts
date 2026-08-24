import type { Func } from "@ozanarslan/utils/function";

import type { Context } from "@/Context/Context";
import { Method } from "@/enums/Method";
import { BaseRoute } from "@/Route/BaseRoute";
import {
	RouteVariant,
	type WebSocketOnClose,
	type WebSocketOnMessage,
	type WebSocketOnOpen,
} from "@/Route/types";

export abstract class WebSocketRouteAbstract<E extends string = string> extends BaseRoute<E> {
	abstract readonly onOpen?: WebSocketOnOpen;

	abstract readonly onClose?: WebSocketOnClose;

	abstract readonly onMessage: WebSocketOnMessage;

	override readonly variant: RouteVariant = RouteVariant.websocket;

	override method: Method = Method.GET;

	get handler(): Func<[Context], WebSocketRouteAbstract> {
		return () => this;
	}
}

import type { Func } from "@ozanarslan/utils";

import { BaseRoute } from "@/C/BaseRouteAbstract";
import type { Context } from "@/C/Context";
import { Method } from "@/C/Method";
import {
	RouteVariant,
	type WebSocketOnClose,
	type WebSocketOnMessage,
	type WebSocketOnOpen,
} from "@/C/Route/types";

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

import type { Context } from "@/Context/Context";
import { Method } from "@/enums/Method";
import { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant, type WebSocketRouteDefinition } from "@/Route/types";
import type { Func } from "@/utils/functions";

export abstract class WebSocketRouteAbstract<E extends string = string> extends BaseRoute<E> {
	abstract readonly onOpen?: WebSocketRouteDefinition["onOpen"];

	abstract readonly onClose?: WebSocketRouteDefinition["onClose"];

	abstract readonly onMessage: WebSocketRouteDefinition["onMessage"];

	override readonly variant: RouteVariant = RouteVariant.websocket;

	override method: Method = Method.GET;

	get handler(): Func<[Context], WebSocketRouteAbstract> {
		return () => this;
	}
}

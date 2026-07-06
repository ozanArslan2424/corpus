import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import { RouteVariant } from "@/BaseRoute/RouteVariant";
import type { Context } from "@/Context/Context";
import { Method } from "@/Method/Method";
import { $registry } from "@/registry";
import type { Func } from "@/utils/functions";
import { joinPathSegments } from "@/utils/joinPathSegments";
import type { WebSocketRouteDefinition } from "@/WebSocketRoute/WebSocketRouteDefinition";

type R = WebSocketRouteAbstract;

export abstract class WebSocketRouteAbstract<
	E extends string = string,
> extends BaseRouteAbstract<E> {
	// FROM CONSTRUCTOR
	abstract readonly path: E;

	abstract readonly onOpen?: WebSocketRouteDefinition["onOpen"];

	abstract readonly onClose?: WebSocketRouteDefinition["onClose"];

	abstract readonly onMessage: WebSocketRouteDefinition["onMessage"];

	// BASE ROUTE PROPERTIES
	variant: RouteVariant = RouteVariant.websocket;

	get endpoint(): string {
		return joinPathSegments($registry.prefix, this.path);
	}

	get method(): Method {
		return Method.GET;
	}

	get handler(): Func<[Context], R> {
		return () => this;
	}

	override model = undefined;
}

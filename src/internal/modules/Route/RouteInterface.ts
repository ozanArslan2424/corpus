import type { Method } from "@/internal/enums/Method";
import type { Endpoint } from "@/internal/types/Endpoint";
import type { RouteHandler } from "@/internal/types/RouteHandler";
import type { RouteId } from "@/internal/types/RouteId";
import type { RouteSchemas } from "@/internal/types/RouteSchemas";

export interface RouteInterface<
	Path extends string = string,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> {
	handler: RouteHandler<R, B, S, P>;
	readonly model?: RouteSchemas<R, B, S, P>;
	controllerId?: string;
	get path(): Endpoint<Path>;
	get method(): Method;
	get pattern(): RegExp;
	get id(): RouteId;
}

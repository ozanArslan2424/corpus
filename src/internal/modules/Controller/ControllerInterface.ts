import type { RouteInterface } from "@/internal/modules/Route/RouteInterface";
import type { RouteHandler } from "@/internal/types/RouteHandler";
import type { RouteDefinition } from "@/internal/types/RouteDefinition";
import type { RouteSchemas } from "@/internal/types/RouteSchemas";

export interface ControllerInterface {
	get id(): string;
	get prefix(): string | undefined;
	route<
		Path extends string = string,
		R = unknown,
		B = unknown,
		S = unknown,
		P = unknown,
	>(
		definition: RouteDefinition<Path>,
		callback: RouteHandler<R, B, S, P>,
		schemas?: RouteSchemas<R, B, S, P>,
	): RouteInterface<Path, R, B, S, P>;
}

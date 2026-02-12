import type { AnyRoute } from "@/internal/types/AnyRoute";

export interface RouterInterface {
	addRoute(route: AnyRoute): void;
	findRoute(url: string, method: string): AnyRoute;
	getRoutes(): Array<AnyRoute>;
	getControllerRoutes(controllerId: string): Array<AnyRoute>;
	updateRoute(route: AnyRoute): void;
}

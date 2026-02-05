import type { RouteContext } from "@/internal/Context/RouteContext";

export type MiddlewareCallback<D = void> = (
	context: RouteContext,
) => Promise<D> | D;

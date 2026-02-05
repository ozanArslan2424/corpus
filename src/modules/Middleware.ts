import { Middleware as _Middleware } from "@/internal/Middleware/Middleware";

/**
 * Simple middleware that runs before the Route "callback" parameters.
 * can return data for {@link Context.data}
 * */

export const Middleware = _Middleware;
export type Middleware<D = void> = _Middleware<D>;

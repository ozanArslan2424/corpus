import type { MiddlewareUseOn } from "./MiddlewareUseOn";
import type { MiddlewareHandler } from "@/Middleware/types/MiddlewareHandler";

export type MiddlewareOptions = {
	useOn: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

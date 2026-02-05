import type { MiddlewareCallback } from "@/internal/Middleware/MiddlewareCallback";

export type MiddlewareProvider<D = void> = {
	middleware: MiddlewareCallback<D>;
};

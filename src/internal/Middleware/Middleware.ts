import { RouteContext } from "@/internal/Context/RouteContext";
import type { Controller } from "@/internal/Controller/Controller";
import type { MiddlewareCallback } from "@/internal/Middleware/MiddlewareCallback";
import type { MiddlewareProvider } from "@/internal/Middleware/MiddlewareProvider";
import { isObjectWith } from "@/utils/isObjectWith";

export class Middleware<D = void> {
	private callback: MiddlewareCallback<D>;

	constructor(argument: MiddlewareCallback<D> | MiddlewareProvider<D>) {
		this.callback = isObjectWith<MiddlewareProvider<D>>(argument, "middleware")
			? argument.middleware
			: argument;
	}

	use(controllers: Controller[]): Controller[] {
		for (const controller of controllers) {
			for (const route of controller.routes) {
				const originalHandler = route.handler;
				route.handler = async (req, ctx) => {
					const context = ctx ?? new RouteContext(req, route.path);
					const data = await this.callback(context);
					context.data = data ?? undefined;
					return originalHandler(req, context);
				};
			}
		}
		return controllers;
	}
}

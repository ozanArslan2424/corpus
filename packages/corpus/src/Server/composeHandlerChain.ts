import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { MiddlewareHandler } from "@/Middleware/types";

export function composeHandlerChain(...handlers: Array<MiddlewareHandler>): MiddlewareHandler {
	return (c, outerNext) => {
		let index = -1;
		const dispatch = (i: number): ReturnType<MiddlewareHandler> => {
			if (i <= index) {
				throw new Exception("next() called multiple times", Status.INTERNAL_SERVER_ERROR);
			}
			index = i;

			const handler = handlers[i];
			if (!handler) return outerNext();

			let called = false;
			let downstream: unknown | undefined;
			const next = async () => {
				called = true;
				downstream = await dispatch(i + 1);
				return downstream;
			};

			return (async () => {
				const resBefore = c.res;
				const result = await handler(c, next);
				if (result !== undefined) return result; // terminal body OR middleware Res short-circuit
				if (!called) return await next();
				if (c.res !== resBefore) return c.res; // outbound mutation wins
				return downstream;
			})();
		};
		return dispatch(0);
	};
}

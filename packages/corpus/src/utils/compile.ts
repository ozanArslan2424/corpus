import type { Func } from "./functions";

export function compile<F extends Func>(
	fns: Array<F | undefined>,
): Func<Parameters<F>, Bun.MaybePromise<Awaited<ReturnType<F>> | void>> {
	return async (...args) => {
		for (const fn of fns) {
			if (!fn) continue;
			const result = await fn(...args);
			if (result !== undefined) return result;
		}
	};
}

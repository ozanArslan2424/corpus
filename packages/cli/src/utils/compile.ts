export function compile<F extends (...args: any[]) => any>(
	fns: Array<F | undefined>,
): (...args: Parameters<F>) => Bun.MaybePromise<Awaited<ReturnType<F>> | void> {
	return async (...args) => {
		for (const fn of fns) {
			if (!fn) continue;
			const result = await fn(...args);
			if (result !== undefined) return result;
		}
	};
}

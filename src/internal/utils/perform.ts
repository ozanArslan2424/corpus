export function perform<T>(cb: () => T): T {
	const start = performance.now();

	const result = cb();

	const end = performance.now();
	const startup = end - start;
	console.log(`🚀 ${cb.name} function took ${startup.toFixed(2)}ms`);

	return result;
}

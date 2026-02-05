import { serveBun } from "@/internal/serve/serveBun";
import { getRuntime } from "@/internal/runtime/getRuntime";
import { serveNodeHTTP } from "@/internal/serve/serveNodeHTTP";
import type { ServeFn } from "@/internal/serve/ServeFn";
import { RuntimeOptions } from "@/internal/runtime/RuntimeOptions";

export const serve: ServeFn = (options) => {
	const runtime = getRuntime();

	switch (runtime) {
		case RuntimeOptions.bun:
			return serveBun(options);
		case RuntimeOptions.node:
			return serveNodeHTTP(options);
		default:
			throw new Error(`Unsupported runtime: ${runtime}`);
	}
};

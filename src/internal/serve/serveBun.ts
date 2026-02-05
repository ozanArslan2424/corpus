import type { ServeOptions } from "@/internal/serve/ServeOptions";

export function serveBun(options: ServeOptions) {
	Bun.serve({
		port: options.port,
		hostname: options.hostname,
		fetch: options.fetch,
		routes: options.staticPages,
	});
}

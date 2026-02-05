import type { HTMLBundle_BunOnly } from "../HTMLBundle/HTMLBundle_BunOnly";

export interface ServeOptions {
	port: number;
	hostname?: "0.0.0.0" | "127.0.0.1" | "localhost" | (string & {}) | undefined;
	fetch: (request: Request) => Promise<Response>;
	staticPages?: Record<string, HTMLBundle_BunOnly>;
}

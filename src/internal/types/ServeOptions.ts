import type { HTMLBundle_BunOnly } from "@/internal/types/HTMLBundle_BunOnly";

export type ServeOptions = {
	port: number;
	hostname?: "0.0.0.0" | "127.0.0.1" | "localhost" | (string & {}) | undefined;
	fetch: (request: Request) => Promise<Response>;
	staticPages?: Record<string, HTMLBundle_BunOnly>;
};

import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import type { ServeOptions } from "@/internal/types/ServeOptions";

export interface ServerInterface {
	readonly router: RouterInterface;
	serve(options: ServeOptions): void;
	listen(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"],
	): Promise<void>;
	close(): Promise<void>;
	handle(request: Request): Promise<Response>;
}

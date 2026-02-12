import { ServerAbstract } from "@/internal/modules/Server/ServerAbstract";
import type { ServerInterface } from "@/internal/modules/Server/ServerInterface";
import type { ServeOptions } from "@/internal/types/ServeOptions";
import type { ServerAppUsingBun } from "@/internal/types/ServerAppUsingBun";

export class ServerUsingBun extends ServerAbstract implements ServerInterface {
	private app: ServerAppUsingBun | undefined;

	serve(options: ServeOptions): void {
		this.app = this.createApp(options);
	}

	async close(): Promise<void> {
		this.logger.log("Shutting down...");
		await this.databaseClient?.disconnect();
		this.app?.stop();
		process.exit(0);
	}

	private createApp(options: ServeOptions): ServerAppUsingBun {
		return Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch: options.fetch,
			routes: options.staticPages,
		});
	}
}

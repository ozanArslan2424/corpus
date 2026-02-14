import { ServerAbstract } from "@/modules/Server/ServerAbstract";
import type { ServerInterface } from "@/modules/Server/ServerInterface";
import type { ServeOptions } from "@/modules/Server/types/ServeOptions";
import type { ServerAppUsingBun } from "@/modules/Server/types/ServerAppUsingBun";

export class ServerUsingBun extends ServerAbstract implements ServerInterface {
	private app: ServerAppUsingBun | undefined;

	serve(options: ServeOptions): void {
		this.app = this.createApp(options);
	}

	async exit(): Promise<void> {
		console.log("Shutting down...");
		this.app?.stop();
		process.exit(0);
	}

	private createApp(options: ServeOptions): ServerAppUsingBun {
		return Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch: options.fetch,
		});
	}
}

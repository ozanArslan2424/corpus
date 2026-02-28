import { ServerAbstract } from "@/Server/ServerAbstract";
import type { ServeOptions } from "@/Server/types/ServeOptions";
import type { ServerAppUsingBun } from "@/Server/types/ServerAppUsingBun";

export class ServerUsingBun extends ServerAbstract {
	private app: ServerAppUsingBun | undefined;

	serve(options: ServeOptions): void {
		this.app = this.createApp(options);
	}

	async close(): Promise<void> {
		await this.app?.stop();
	}

	private createApp(options: ServeOptions): ServerAppUsingBun {
		return Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch: options.fetch,
		});
	}
}

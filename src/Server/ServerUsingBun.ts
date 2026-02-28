import { setRouterInstance } from "@/index";
import { Config } from "@/Config/Config";
import { Router } from "@/Router/Router";
import { ServerAbstract } from "@/Server/ServerAbstract";
import type { ServeOptions } from "@/Server/types/ServeOptions";
import type { ServerAppUsingBun } from "@/Server/types/ServerAppUsingBun";

export class ServerUsingBun extends ServerAbstract {
	private app: ServerAppUsingBun | undefined;

	constructor() {
		super();
		setRouterInstance(new Router());
	}

	serve(options: ServeOptions): void {
		this.app = this.createApp(options);
	}

	async close(): Promise<void> {
		await this.handleBeforeClose?.();
		console.log("Closing...");

		await this.app?.stop();

		if (Config.nodeEnv !== "test") {
			process.exit(0);
		}
	}

	private createApp(options: ServeOptions): ServerAppUsingBun {
		return Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch: options.fetch,
		});
	}
}

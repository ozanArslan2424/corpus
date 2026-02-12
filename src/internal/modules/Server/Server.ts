import { getRuntime } from "@/internal/global/getRuntime";
import type { ServerInterface } from "@/internal/modules/Server/ServerInterface";
import type { CoreumServerOptions } from "@/internal/types/CoreumServerOptions";
import { ServerAbstract } from "@/internal/modules/Server/ServerAbstract";
import { RuntimeOptions } from "@/internal/enums/RuntimeOptions";
import { ServerUsingBun } from "@/internal/modules/Server/ServerUsingBun";
import { ServerUsingNode } from "@/internal/modules/Server/ServerUsingNode";
import type { ServeOptions } from "@/internal/types/ServeOptions";
import { setServerInstance } from "@/internal/global/ServerInstance";

/**
 * Server is the entrypoint to the app.
 * It takes the routes, controllers, middlewares, and HTML bundles for static pages.
 * A router instance must be passed to a {@link Server} to start listening.
 * At least one controller is required for middlewares to work.
 * You can pass a {@link DatabaseClientInterface} instance to connect and disconnect.
 * You can pass your {@link Cors} object.
 * */

export class Server extends ServerAbstract implements ServerInterface {
	constructor(options: CoreumServerOptions) {
		super(options);
		this.instance = this.getInstance(options);
		setServerInstance(this);
	}

	serve(options: ServeOptions): void {
		return this.instance.serve(options);
	}

	async close(): Promise<void> {
		return await this.instance.close();
	}

	private instance: ServerInterface;

	private getInstance(options: CoreumServerOptions): ServerInterface {
		const runtime = getRuntime();

		switch (runtime) {
			case RuntimeOptions.bun:
				return new ServerUsingBun(options);
			case RuntimeOptions.node:
				return new ServerUsingNode(options);
			default:
				throw new Error(`Unsupported runtime: ${runtime}`);
		}
	}
}

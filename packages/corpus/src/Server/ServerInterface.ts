import type { RouterData } from "@/Router/RouterData";
import type { ErrorHandler } from "@/Server/ErrorHandler";
import type { RequestHandler } from "@/Server/RequestHandler";
import type { Func } from "@/utils/functions";
import type { OrString } from "@/utils/strings";

export interface ServerInterface {
	get routes(): Array<RouterData>;

	setGlobalPrefix(value: string): void;

	listen(port: number, hostname?: OrString<"0.0.0.0" | "127.0.0.1" | "localhost">): Promise<void>;

	close(closeActiveConnections?: boolean): Promise<void>;

	handle(request: Request): Promise<Response>;

	/**
	 *
	 * Default error handler response will have a status of C.Error or 500 and json:
	 *
	 * ```typescript
	 * { error: unknown | true, message: string }
	 * ```
	 *
	 * If throw something other than an Error instance, you should probably handle it.
	 * However the default response will have a status of 500 and json:
	 *
	 * ```typescript
	 * { error: Instance, message: "Unknown" }
	 * ```
	 */
	setOnError(handler: ErrorHandler): void;
	defaultErrorHandler: ErrorHandler;

	/**
	 *
	 * Default not found handler response will have a status of 404 and json:
	 *
	 * ```typescript
	 * { error: true, message: `${req.method} on ${req.url} does not exist.` }
	 * ```
	 */
	setOnNotFound(handler: RequestHandler): void;
	defaultNotFoundHandler: RequestHandler;

	setOnBeforeListen(handler: Func<[], Bun.MaybePromise<void>> | undefined): void;
	defaultOnBeforeListen: Func<[], Bun.MaybePromise<void>> | undefined;

	setOnBeforeClose(handler: () => Bun.MaybePromise<void>): void;
	defaultOnBeforeClose: Func<[], Bun.MaybePromise<void>> | undefined;
}

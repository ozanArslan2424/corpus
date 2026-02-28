import type { CorsOptions } from "@/Cors/types/CorsOptions";
import type { ErrorHandler } from "@/Server/types/ErrorHandler";
import type { MaybePromise } from "@/utils/types/MaybePromise";
import type { RequestHandler } from "@/Server/types/RequestHandler";
import type { ServeOptions } from "@/Server/types/ServeOptions";
import { _globalPrefixEnvKey } from "@/Config/constants/_globalPrefixEnvKey";
import type { AfterResponseHandler } from "@/Server/types/AfterResponseHandler";

export interface ServerInterface {
	serve(options: ServeOptions): void;

	close(): Promise<void>;

	setGlobalPrefix(value: string): void;

	setCors(cors: CorsOptions): void;

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

	/**
	 *
	 * Default not found handler response will have a status of 404 and json:
	 *
	 * ```typescript
	 * { error: true, message: `${req.method} on ${req.url} does not exist.` }
	 * ```
	 */
	setOnNotFound(handler: RequestHandler): void;

	setOnBeforeListen(handler: () => MaybePromise<void>): void;

	setOnBeforeClose(handler: () => MaybePromise<void>): void;

	setOnAfterResponse(handler: AfterResponseHandler): void;

	listen(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"],
	): Promise<void>;

	handle(request: Request): Promise<Response>;
}

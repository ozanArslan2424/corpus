import { Status } from "@/internal/enums/Status";
import { makeLogger } from "@/internal/global/LoggerClass";
import { getRuntime } from "@/internal/global/getRuntime";
import type { ServerInterface } from "@/internal/modules/Server/ServerInterface";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";
import { CoreumError } from "@/internal/modules/CoreumError/CoreumError";
import { CoreumRequest } from "@/internal/modules/CoreumRequest/CoreumRequest";
import { CoreumResponse } from "@/internal/modules/CoreumResponse/CoreumResponse";
import type { CoreumResponseBody } from "@/internal/types/CoreumResponseBody";
import type { CoreumServerOptions } from "@/internal/types/CoreumServerOptions";
import type { ErrorCallback } from "@/internal/types/ErrorCallback";
import type { FetchCallback } from "@/internal/types/FetchCallback";
import type { ServeOptions } from "@/internal/types/ServeOptions";
import { getArrayByteSize } from "@/internal/utils/formatBytes";
import { RouteContext, type DatabaseClientInterface } from "@/exports";
import type { CorsInterface } from "@/internal/modules/Cors/CorsInterface";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import { Router } from "@/internal/modules/Router/Router";

export abstract class ServerAbstract implements ServerInterface {
	protected readonly logger = makeLogger("Coreum");

	constructor(protected readonly options: CoreumServerOptions) {
		if (options.onError) this.handleError = options.onError;
		if (options.onNotFound) this.handleNotFound = options.onNotFound;
	}

	abstract serve(options: ServeOptions): void;
	abstract close(): Promise<void>;

	readonly router: RouterInterface = new Router();
	protected cors: CorsInterface | undefined;
	protected databaseClient: DatabaseClientInterface | undefined;

	setCors(cors: CorsInterface) {
		this.cors = cors;
	}

	setDatabaseClient(databaseClient: DatabaseClientInterface) {
		this.databaseClient = databaseClient;
	}

	async listen(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"],
	): Promise<void> {
		try {
			await this.prepare(port, hostname);
			this.serve({
				port,
				hostname,
				staticPages: this.options.staticPages,
				fetch: (r) => this.handle(r),
			});
		} catch (err) {
			this.logger.error("Server unable to start:", err);
			await this.close();
		}
	}

	async handle(request: Request): Promise<Response> {
		const req = new CoreumRequest(request);
		const res = await this.getResponse(req);
		if (this.cors !== undefined) {
			this.cors.apply(req, res);
		}
		return res.response;
	}

	private async prepare(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"],
	) {
		process.on("SIGINT", () => this.close());
		process.on("SIGTERM", () => this.close());

		const routes = this.router.getRoutes();
		const startMessages = [
			`Runtime: ${getRuntime()}`,
			`Hostname: ${hostname}`,
			`Port: ${port}`,
			`Router size: ${getArrayByteSize(routes)}`,
			`Routes: ${JSON.stringify(
				routes.map(({ id }) => id),
				null,
				2,
			)}`,
		];

		this.logger.log(startMessages.join("\n"));

		await this.databaseClient?.connect();
	}

	private handleError: ErrorCallback = async (err) => {
		let body: CoreumResponseBody = err;
		let status: number = Status.INTERNAL_SERVER_ERROR;

		if (err instanceof CoreumError) {
			body = err.data ?? err.message;
			status = err.status;
		}

		return new CoreumResponse(body, { status });
	};

	private handleNotFound: FetchCallback = async (req) => {
		return new CoreumResponse(`${req.method} on ${req.input} does not exist.`, {
			status: Status.NOT_FOUND,
		});
	};

	private handleMethodNotAllowed: FetchCallback = async (req) => {
		return new CoreumResponse(`${req.method} does not exist.`, {
			status: Status.METHOD_NOT_ALLOWED,
		});
	};

	private handlePreflight = async () => {
		return new CoreumResponse("Departed");
	};

	private handleRoute: FetchCallback = async (req) => {
		const route = this.router.findRoute(req.url, req.method);
		const ctx = await RouteContext.makeFromRequest(
			req,
			route.path,
			route.model,
		);
		const returnData = await route.handler(ctx);
		if (returnData instanceof CoreumResponse) {
			return returnData;
		}

		return new CoreumResponse(returnData, {
			status: ctx.res.status,
			statusText: ctx.res.statusText,
			headers: ctx.res.headers,
			cookies: ctx.res.cookies,
		});
	};

	private async getResponse(
		req: CoreumRequestInterface,
	): Promise<CoreumResponseInterface> {
		try {
			if (req.isPreflight) {
				return await this.handlePreflight();
			}

			return await this.handleRoute(req);
		} catch (err) {
			if (CoreumError.isStatusOf(err, Status.NOT_FOUND)) {
				return await this.handleNotFound(req);
			}

			if (CoreumError.isStatusOf(err, Status.METHOD_NOT_ALLOWED)) {
				return await this.handleMethodNotAllowed(req);
			}

			return await this.handleError(err as Error);
		}
	}
}

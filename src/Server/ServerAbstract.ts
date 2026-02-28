import { Status } from "@/Response/enums/Status";
import { getRouterInstance } from "@/index";
import { Config } from "@/Config/Config";
import { Cors } from "@/Cors/Cors";
import { HttpError } from "@/Error/HttpError";
import { HttpRequest } from "@/Request/HttpRequest";
import { HttpResponse } from "@/Response/HttpResponse";
import type { CorsOptions } from "@/Cors/types/CorsOptions";
import type { ErrorHandler } from "@/Server/types/ErrorHandler";
import type { MaybePromise } from "@/utils/types/MaybePromise";
import type { RequestHandler } from "@/Server/types/RequestHandler";
import type { ServeOptions } from "@/Server/types/ServeOptions";
import { _globalPrefixEnvKey } from "@/Config/constants/_globalPrefixEnvKey";
import type { ServerInterface } from "@/Server/ServerInterface";
import type { AfterResponseHandler } from "@/Server/types/AfterResponseHandler";

export abstract class ServerAbstract implements ServerInterface {
	abstract serve(options: ServeOptions): void;
	abstract close(): Promise<void>;

	protected cors: Cors | undefined;

	get routes(): Array<[string, string]> {
		return getRouterInstance().getRouteList();
	}

	setGlobalPrefix(value: string): void {
		Config.set(_globalPrefixEnvKey, value);
	}

	setCors(cors: CorsOptions): void {
		this.cors = new Cors(cors);
	}

	setOnError(handler: ErrorHandler): void {
		this.handleError = handler;
	}

	setOnNotFound(handler: RequestHandler): void {
		this.handleNotFound = handler;
	}

	setOnBeforeListen(handler: () => MaybePromise<void>): void {
		this.handleBeforeListen = handler;
	}

	setOnBeforeClose(handler: () => MaybePromise<void>): void {
		this.handleBeforeClose = handler;
	}

	setOnAfterResponse(handler: AfterResponseHandler): void {
		this.handleAfterResponse = handler;
	}

	async listen(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"] = "0.0.0.0",
	): Promise<void> {
		try {
			process.on("SIGINT", () => this.close());
			process.on("SIGTERM", () => this.close());

			console.log(`Listening on ${hostname}:${port}`);

			await this.handleBeforeListen?.();
			this.serve({
				port,
				hostname,
				fetch: (r) => this.handle(r),
			});
		} catch (err) {
			console.error("Server unable to start:", err);
			await this.close();
		}
	}

	async handle(request: Request): Promise<Response> {
		const req = new HttpRequest(request);
		let res = await this.getResponse(req);
		if (this.cors !== undefined) {
			this.cors.apply(req, res);
		}
		if (this.handleAfterResponse) {
			res = await this.handleAfterResponse(res);
		}
		return res.response;
	}

	private async getResponse(req: HttpRequest): Promise<HttpResponse> {
		try {
			if (req.isPreflight) {
				return new HttpResponse("Departed");
			}

			const handler = getRouterInstance().getRouteHandler(req);
			return await handler();
		} catch (err) {
			if (err instanceof HttpError) {
				if (err.isStatusOf(Status.NOT_FOUND)) {
					return await this.handleNotFound(req);
				}

				if (err.isStatusOf(Status.METHOD_NOT_ALLOWED)) {
					return await this.handleMethodNotAllowed(req);
				}
			}
			return await this.handleError(err as Error);
		}
	}

	protected handleBeforeListen: (() => MaybePromise<void>) | undefined;
	protected handleBeforeClose: (() => MaybePromise<void>) | undefined;
	protected handleAfterResponse: AfterResponseHandler;

	protected handleError: ErrorHandler = async (err) => {
		if (!(err instanceof Error)) {
			return new HttpResponse(
				{ error: err, message: "Unknown" },
				{ status: Status.INTERNAL_SERVER_ERROR },
			);
		}

		if (err instanceof HttpError) {
			return err.toResponse();
		}
		return new HttpResponse(
			{ error: err, message: err.message },
			{ status: Status.INTERNAL_SERVER_ERROR },
		);
	};

	protected handleNotFound: RequestHandler = async (req) => {
		return new HttpResponse(
			{ error: true, message: `${req.method} on ${req.url} does not exist.` },
			{ status: Status.NOT_FOUND },
		);
	};

	protected handleMethodNotAllowed: RequestHandler = async (req) => {
		return new HttpResponse(
			{ error: `${req.method} does not exist.` },
			{ status: Status.METHOD_NOT_ALLOWED },
		);
	};
}

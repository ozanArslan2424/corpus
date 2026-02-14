import { Status } from "@/modules/HttpResponse/enums/Status";
import type { ServerInterface } from "@/modules/Server/ServerInterface";
import type { HttpRequestInterface } from "@/modules/HttpRequest/HttpRequestInterface";
import type { HttpResponseInterface } from "@/modules/HttpResponse/HttpResponseInterface";
import { HttpError } from "@/modules/HttpError/HttpError";
import { HttpRequest } from "@/modules/HttpRequest/HttpRequest";
import { HttpResponse } from "@/modules/HttpResponse/HttpResponse";
import type { HttpResponseBody } from "@/modules/HttpResponse/types/HttpResponseBody";
import type { RequestHandler } from "@/modules/Server/types/RequestHandler";
import type { ServeOptions } from "@/modules/Server/types/ServeOptions";
import type { CorsInterface } from "@/modules/Cors/CorsInterface";
import type { RouterInterface } from "@/modules/Router/RouterInterface";
import { Router } from "@/modules/Router/Router";
import type { ErrorHandler } from "@/modules/Server/types/ErrorHandler";
import { RouteContext } from "@/modules/RouteContext/RouteContext";
import { Cors } from "@/modules/Cors/Cors";
import type { CorsOptions } from "@/modules/Cors/types/CorsOptions";
import type { MaybePromise } from "@/utils/MaybePromise";

export abstract class ServerAbstract implements ServerInterface {
	abstract serve(options: ServeOptions): void;
	abstract exit(): Promise<void>;

	readonly router: RouterInterface = new Router();
	protected cors: CorsInterface | undefined;
	protected handleBeforeListen: (() => MaybePromise<void>) | undefined;
	protected handleBeforeExit: (() => MaybePromise<void>) | undefined;

	setGlobalPrefix(value: string): void {
		this.router.globalPrefix = value;
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

	setOnBeforeExit(handler: () => MaybePromise<void>): void {
		this.handleBeforeExit = handler;
	}

	setOnBeforeListen(handler: () => MaybePromise<void>): void {
		this.handleBeforeListen = handler;
	}

	async listen(
		port: ServeOptions["port"],
		hostname: ServeOptions["hostname"] = "0.0.0.0",
	): Promise<void> {
		try {
			await this.prepare(port, hostname);
			await this.handleBeforeListen?.();
			this.serve({
				port,
				hostname,
				fetch: (r) => this.handle(r),
			});
		} catch (err) {
			console.error("Server unable to start:", err);
			await this.exit();
		}
	}

	async handle(request: Request): Promise<Response> {
		const req = new HttpRequest(request);
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
		process.on("SIGINT", () => this.exit());
		process.on("SIGTERM", () => this.exit());
		const routes = this.router
			.getRoutes()
			.map((r) => `[${r.method}]\t:\t${r.path}`)
			.join("\n");
		console.log(`Listening on ${hostname}:${port}\n${routes}`);
	}

	private handleError: ErrorHandler = async (err) => {
		let body: HttpResponseBody = err;
		let status: number = Status.INTERNAL_SERVER_ERROR;

		if (err instanceof HttpError) {
			body = err.data ?? err.message;
			status = err.status;
		}

		return new HttpResponse(body, { status });
	};

	private handleNotFound: RequestHandler = async (req) => {
		return new HttpResponse(`${req.method} on ${req.url} does not exist.`, {
			status: Status.NOT_FOUND,
		});
	};

	private handleMethodNotAllowed: RequestHandler = async (req) => {
		return new HttpResponse(`${req.method} does not exist.`, {
			status: Status.METHOD_NOT_ALLOWED,
		});
	};

	private handlePreflight = async () => {
		return new HttpResponse("Departed");
	};

	private handleRoute: RequestHandler = async (req) => {
		const route = this.router.findRoute(req.url, req.method);
		const ctx = await RouteContext.makeFromRequest(req, route);
		const returnData = await route.handler(ctx);
		if (returnData instanceof HttpResponse) {
			return returnData;
		}

		return new HttpResponse(returnData, {
			status: ctx.res.status,
			statusText: ctx.res.statusText,
			headers: ctx.res.headers,
			cookies: ctx.res.cookies,
		});
	};

	private async getResponse(
		req: HttpRequestInterface,
	): Promise<HttpResponseInterface> {
		try {
			if (req.isPreflight) {
				return await this.handlePreflight();
			}

			return await this.handleRoute(req);
		} catch (err) {
			if (HttpError.isStatusOf(err, Status.NOT_FOUND)) {
				return await this.handleNotFound(req);
			}

			if (HttpError.isStatusOf(err, Status.METHOD_NOT_ALLOWED)) {
				return await this.handleMethodNotAllowed(req);
			}

			return await this.handleError(err as Error);
		}
	}
}

import { type DBClientInterface } from "@/internal/DBClient/DBClientInterface";
import { type ServeOptions } from "@/internal/serve/ServeOptions";
import { getRuntime } from "@/internal/runtime/getRuntime";
import { serve } from "@/internal/serve/serve";
import { Controller } from "@/internal/Controller/Controller";
import { Cors } from "@/internal/Cors/Cors";
import { Middleware } from "@/internal/Middleware/Middleware";
import { type HTMLBundle_BunOnly } from "@/internal/HTMLBundle/HTMLBundle_BunOnly";
import { Route } from "@/internal/Route/Route";
import { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";
import { Status } from "@/internal/Status/Status";
import { textIsEqual } from "@/utils/textIsEqual";
import { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";
import type { ErrorCallback } from "@/internal/CoreumServer/ErrorCallback";
import type { FetchCallback } from "@/internal/CoreumServer/FetchCallback";
import type { CoreumServerOptions } from "@/internal/CoreumServer/CoreumServerOptions";

export class CoreumServer {
	// TODO: Update logger
	private readonly logger = console;
	readonly routes = new Map<string, Route>();

	db?: DBClientInterface;
	controllers: Controller[];
	middlewares?: Middleware[];
	floatingRoutes?: Route[];
	staticPages?: Record<string, HTMLBundle_BunOnly>;
	cors?: Cors;
	onError?: ErrorCallback;
	onNotFound?: FetchCallback;
	onMethodNotAllowed?: FetchCallback;

	constructor(readonly options: CoreumServerOptions) {
		this.db = options.db;
		this.controllers = options.controllers;
		this.middlewares = options.middlewares;
		this.floatingRoutes = options.floatingRoutes;
		this.staticPages = options.staticPages;
		this.cors = options.cors;
		this.onError = options.onError;
		this.onNotFound = options.onNotFound;
		this.onMethodNotAllowed = options.onMethodNotAllowed;

		if (this.middlewares && this.middlewares.length > 0) {
			for (const middleware of this.middlewares) {
				this.controllers = middleware.use(options.controllers);
			}
		}

		for (const controller of this.controllers) {
			for (const route of controller.routes) {
				this.routes.set(route.id, route);
			}
		}

		if (this.floatingRoutes && this.floatingRoutes.length > 0) {
			for (const floatingRoute of this.floatingRoutes) {
				this.routes.set(floatingRoute.id, floatingRoute);
			}
		}

		console.log(this.routes.keys());
	}

	private async getResponse(req: CoreumRequest): Promise<CoreumResponse> {
		try {
			if (req.isPreflight) {
				return new CoreumResponse("Departed");
			}

			if (req.isMethodNotAllowed) {
				return await this.handleMethodNotAllowed(req);
			}

			const route = this.findMatchingRoute(req);
			if (route) {
				return await route.handler(req);
			}

			return await this.handleNotFound(req);
		} catch (err) {
			return await this.handleError(err as Error);
		}
	}

	public async handleFetch(req: CoreumRequest): Promise<CoreumResponse> {
		const res = await this.getResponse(req);

		if (this.cors !== undefined) {
			const headers = this.cors.getCorsHeaders(req, res);
			res.headers.innerCombine(headers);
		}

		return res;
	}

	private handleMethodNotAllowed: FetchCallback = async (req) => {
		if (this.onMethodNotAllowed) {
			return this.onMethodNotAllowed(req);
		}
		return new CoreumResponse(`${req.method} does not exist.`, {
			status: Status.METHOD_NOT_ALLOWED,
		});
	};

	private handleNotFound: FetchCallback = async (req) => {
		if (this.onNotFound) {
			return this.onNotFound(req);
		}
		return new CoreumResponse(`${req.method} on ${req.url} does not exist.`, {
			status: Status.NOT_FOUND,
		});
	};

	private handleError: ErrorCallback = async (err) => {
		if (this.onError) {
			return this.onError(err);
		}
		return new CoreumResponse(err, {
			status: Status.INTERNAL_SERVER_ERROR,
		});
	};

	private findMatchingRoute(req: CoreumRequest): Route | undefined {
		const url = new URL(req.url);
		let path = url.pathname;
		return Array.from(this.routes.values()).find(
			(route) =>
				path.match(route.pattern) &&
				textIsEqual(req.method, route.method, "upper"),
		);
	}

	private async exit() {
		this.logger.log("Shutting down gracefully...");
		await this.db?.disconnect();
		process.exit(0);
	}

	public async handle(request: Request) {
		const req = new CoreumRequest(request);
		const res = await this.handleFetch(req);
		return res.response;
	}

	public async listen(
		port?: ServeOptions["port"],
		hostname?: ServeOptions["hostname"],
	) {
		try {
			process.on("SIGINT", () => this.exit());
			process.on("SIGTERM", () => this.exit());

			this.logger.log(
				`Coreum server starting... Runtime: ${getRuntime()} Hostname: ${hostname} Port: ${port}`,
			);

			await this.db?.connect();

			serve({
				port: port ?? 3000,
				hostname: hostname,
				staticPages: this.staticPages,
				fetch: (r) => this.handle(r),
			});
		} catch (err) {
			this.logger.error("Server unable to start:", err);
			await this.exit();
		}
	}
}

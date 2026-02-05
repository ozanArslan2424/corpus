import type { Controller } from "@/internal/Controller/Controller";
import type { Cors } from "@/internal/Cors/Cors";
import type { DBClientInterface } from "@/internal/DBClient/DBClientInterface";
import type { HTMLBundle_BunOnly } from "@/internal/HTMLBundle/HTMLBundle_BunOnly";
import type { Middleware } from "@/internal/Middleware/Middleware";
import type { Route } from "@/internal/Route/Route";
import type { ErrorCallback } from "@/internal/CoreumServer/ErrorCallback";
import type { FetchCallback } from "@/internal/CoreumServer/FetchCallback";

export type CoreumServerOptions = {
	db?: DBClientInterface;
	controllers: Controller[];
	middlewares?: Middleware<any>[];
	floatingRoutes?: Route<any, any, any, any, any>[];
	staticPages?: Record<string, HTMLBundle_BunOnly>;
	cors?: Cors;
	onError?: ErrorCallback;
	onNotFound?: FetchCallback;
	onMethodNotAllowed?: FetchCallback;
};

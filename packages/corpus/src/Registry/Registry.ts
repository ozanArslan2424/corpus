import type { Middleware } from "@/Middleware/Middleware";
import { BodyParser } from "@/Parser/BodyParser";
import { FormDataParser } from "@/Parser/FormDataParser";
import { SchemaParser } from "@/Parser/SchemaParser";
import { SearchParamsParser } from "@/Parser/SearchParamsParser";
import { URLParamsParser } from "@/Parser/URLParamsParser";
import type {
	BodyParserInterface,
	CorsInterface,
	MiddlewareRouterInterface,
	ObjectParserInterface,
	RegistryDocEntry,
	RegistryInterface,
	RouterInterface,
	SchemaParserInterface,
} from "@/Registry/types";
import type { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant } from "@/Route/types";
import { BranchRouter } from "@/Router/BranchRouter";
import { MiddlewareRouter } from "@/Router/MiddlewareRouter";
import { arrIncludes } from "@/utils/arrays";
import { joinPathSegments } from "@/utils/joinPathSegments";

export class Registry implements RegistryInterface {
	constructor() {
		this.reset();
	}

	reset(): void {
		this.router = new BranchRouter();
		this.docs = new Map();
		this.cors = null;
		this.prefix = "";
		this.middlewareRouter = new MiddlewareRouter();
		this.urlParamsParser = new URLParamsParser();
		this.searchParamsParser = new SearchParamsParser();
		this.formDataParser = new FormDataParser();
		this.bodyParser = new BodyParser(this.formDataParser, this.searchParamsParser);
		this.schemaParser = new SchemaParser();
	}

	cors!: CorsInterface | null;

	prefix!: string;

	middlewareRouter!: MiddlewareRouterInterface;

	urlParamsParser!: ObjectParserInterface<Record<string, string>>;

	searchParamsParser!: ObjectParserInterface<URLSearchParams>;

	formDataParser!: ObjectParserInterface<FormData>;

	bodyParser!: BodyParserInterface;

	schemaParser!: SchemaParserInterface;

	router!: RouterInterface;

	docs!: Map<string, RegistryDocEntry>;

	register(
		kind: "route" | "middleware" | "cors",
		item: BaseRoute<any, any, any, any, any> | Middleware | CorsInterface,
	): void {
		switch (kind) {
			case "route":
				const route = item as BaseRoute;
				this.registerRoute(route);
				break;
			case "middleware":
				const middleware = item as Middleware;
				this.registerMiddleware(middleware);
				break;
			case "cors":
				const cors = item as CorsInterface;
				this.registerCors(cors);
				break;
		}
	}

	registerRoute(route: BaseRoute): void {
		if (arrIncludes(route.variant, [RouteVariant.dynamic, RouteVariant.websocket])) {
			route.endpoint = joinPathSegments(this.prefix, route.endpoint);
		}

		this.router.add(route);
	}

	registerMiddleware(middleware: Middleware): void {
		this.middlewareRouter.add(middleware);
	}

	registerCors(cors: CorsInterface): void {
		this.cors = cors;
	}
}

import type { Middleware } from "@/Middleware/Middleware";
import { BodyParser } from "@/Parser/BodyParser";
import { FormDataParser } from "@/Parser/FormDataParser";
import { SchemaParser } from "@/Parser/SchemaParser";
import { SearchParamsParser } from "@/Parser/SearchParamsParser";
import { URLParamsParser } from "@/Parser/URLParamsParser";
import type {
	BodyParserInterface,
	CorsInterface,
	ObjectParserInterface,
	RegistryInterface,
	RouterInterface,
	SchemaParserInterface,
} from "@/Registry/types";
import type { BaseRoute } from "@/Route/BaseRoute";
import { RouteVariant } from "@/Route/types";
import { InternalRouteRegexpMatcher } from "@/Router/InternalRouteRegexpMatcher";
import { arrIncludes } from "@ozanarslan/utils/array";
import { joinPathSegments } from "@ozanarslan/utils/joinPathSegments";

export class Registry implements RegistryInterface {
	constructor() {
		this.reset();
	}

	reset(): void {
		this.router = new InternalRouteRegexpMatcher();
		this.cors = null;
		this.prefix = "";
		this.urlParamsParser = new URLParamsParser();
		this.searchParamsParser = new SearchParamsParser();
		this.formDataParser = new FormDataParser();
		this.bodyParser = new BodyParser(this.formDataParser, this.searchParamsParser);
		this.schemaParser = new SchemaParser();
	}

	cors!: CorsInterface | null;

	prefix!: string;

	urlParamsParser!: ObjectParserInterface<Record<string, string>>;

	searchParamsParser!: ObjectParserInterface<URLSearchParams>;

	formDataParser!: ObjectParserInterface<FormData>;

	bodyParser!: BodyParserInterface;

	schemaParser!: SchemaParserInterface;

	router!: RouterInterface;

	register(
		kind: "route" | "middleware" | "cors",
		item: BaseRoute | Middleware | CorsInterface,
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
		this.router.addMiddleware(middleware);
	}

	registerCors(cors: CorsInterface): void {
		this.cors = cors;
	}
}

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
import type { RouterData } from "@/Router/types";
import { arrIncludes } from "@/utils/arrays";
import { internFunc, type Func } from "@/utils/functions";
import { joinPathSegments } from "@/utils/joinPathSegments";
import { objGetEntries } from "@/utils/objects";
import { strRemoveWhitespace } from "@/utils/strings";

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

	private readonly funcMap = new Map<string, Func>();

	registerRoute(route: BaseRoute<any, any, any, any, any>): void {
		const data: RouterData = {
			id: route.id,
			endpoint: route.endpoint,
			method: route.method,
			handler: route.handler,
			variant: route.variant,
		};

		if (arrIncludes(data.variant, [RouteVariant.dynamic, RouteVariant.websocket])) {
			data.endpoint = joinPathSegments(this.prefix, route.endpoint);
		}

		if (route.model) {
			const { config, ...model } = route.model;
			if (config) data.config = config;

			data.validators ??= {};
			for (const [key, schema] of objGetEntries(model)) {
				if (key === "response") continue;
				if (!schema) continue;
				data.validators[key] = internFunc(
					this.funcMap,
					schema["~standard"].validate,
					"model",
					strRemoveWhitespace(JSON.stringify(schema)),
				);
			}
		}

		this.router.add(data);
		this.docs.set(data.id, {
			id: data.id,
			endpoint: data.endpoint,
			method: data.method,
			model: route.model,
		});
	}

	registerMiddleware(middleware: Middleware): void {
		this.middlewareRouter.add(middleware);
	}

	registerCors(cors: CorsInterface): void {
		this.cors = cors;
	}
}

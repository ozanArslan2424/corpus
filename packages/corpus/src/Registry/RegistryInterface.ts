import type { CorsInterface } from "@/Cors/CorsInterface";
import type { MiddlewareRouterInterface } from "@/MiddlewareRouter/MiddlewareRouterInterface";
import type { BodyParserInterface } from "@/Parser/BodyParserInterface";
import type { ObjectParserInterface } from "@/Parser/ObjectParserInterface";
import type { SchemaParserInterface } from "@/Parser/SchemaParserInterface";
import type { RegistryDocEntry } from "@/Registry/RegistryDocEntry";
import type { RouterInterface } from "@/Router/RouterInterface";
import type { RouterAdapterInterface } from "@/RouterAdapter/RouterAdapterInterface";

export interface RegistryInterface {
	adapter: RouterAdapterInterface;
	router: RouterInterface;
	docs: Map<string, RegistryDocEntry>;
	cors: CorsInterface | null;
	prefix: string;
	middlewares: MiddlewareRouterInterface;
	urlParamsParser: ObjectParserInterface<Record<string, string>>;
	searchParamsParser: ObjectParserInterface<URLSearchParams>;
	formDataParser: ObjectParserInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
	reset(): void;
}

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
	RouterAdapterInterface,
	RouterInterface,
	SchemaParserInterface,
} from "@/Registry/types";
import { BranchRouterAdapter } from "@/Router/BranchRouterAdapter";
import { MiddlewareRouter } from "@/Router/MiddlewareRouter";
import { Router } from "@/Router/Router";

export class Registry implements RegistryInterface {
	constructor() {
		this.reset();
	}

	reset(): void {
		this.adapter = new BranchRouterAdapter();
		this.router = new Router(this.adapter);
		this.docs = new Map();
		this.cors = null;
		this.prefix = "";
		this.middlewares = new MiddlewareRouter();
		this.urlParamsParser = new URLParamsParser();
		this.searchParamsParser = new SearchParamsParser();
		this.formDataParser = new FormDataParser();
		this.bodyParser = new BodyParser(this.formDataParser, this.searchParamsParser);
		this.schemaParser = new SchemaParser();
	}

	private _adapter!: RouterAdapterInterface;
	public get adapter(): RouterAdapterInterface {
		return this._adapter;
	}
	public set adapter(value: RouterAdapterInterface) {
		this._adapter = value;
		this.router = new Router(value);
	}

	cors!: CorsInterface | null;

	prefix!: string;

	middlewares!: MiddlewareRouterInterface;

	urlParamsParser!: ObjectParserInterface<Record<string, string>>;

	searchParamsParser!: ObjectParserInterface<URLSearchParams>;

	formDataParser!: ObjectParserInterface<FormData>;

	bodyParser!: BodyParserInterface;

	schemaParser!: SchemaParserInterface;

	router!: RouterInterface;

	docs!: Map<string, RegistryDocEntry>;
}

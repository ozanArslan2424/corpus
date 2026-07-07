import { BodyParser } from "@/Parsers/BodyParser";
import { FormDataParser } from "@/Parsers/FormDataParser";
import { SchemaParser } from "@/Parsers/SchemaParser";
import { SearchParamsParser } from "@/Parsers/SearchParamsParser";
import { URLParamsParser } from "@/Parsers/URLParamsParser";
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

	private _cors!: CorsInterface | null;
	public get cors(): CorsInterface | null {
		return this._cors;
	}
	public set cors(value: CorsInterface | null) {
		this._cors = value;
	}

	private _prefix!: string;
	public get prefix(): string {
		return this._prefix;
	}
	public set prefix(value: string) {
		this._prefix = value;
	}

	private _middlewares!: MiddlewareRouterInterface;
	public get middlewares(): MiddlewareRouterInterface {
		return this._middlewares;
	}
	public set middlewares(value: MiddlewareRouterInterface) {
		this._middlewares = value;
	}

	private _urlParamsParser!: ObjectParserInterface<Record<string, string>>;
	public get urlParamsParser(): ObjectParserInterface<Record<string, string>> {
		return this._urlParamsParser;
	}
	public set urlParamsParser(value: ObjectParserInterface<Record<string, string>>) {
		this._urlParamsParser = value;
	}

	private _searchParamsParser!: ObjectParserInterface<URLSearchParams>;
	public get searchParamsParser(): ObjectParserInterface<URLSearchParams> {
		return this._searchParamsParser;
	}
	public set searchParamsParser(value: ObjectParserInterface<URLSearchParams>) {
		this._searchParamsParser = value;
	}

	private _formDataParser!: ObjectParserInterface<FormData>;
	public get formDataParser(): ObjectParserInterface<FormData> {
		return this._formDataParser;
	}
	public set formDataParser(value: ObjectParserInterface<FormData>) {
		this._formDataParser = value;
	}

	private _bodyParser!: BodyParserInterface;
	public get bodyParser(): BodyParserInterface {
		return this._bodyParser;
	}
	public set bodyParser(value: BodyParserInterface) {
		this._bodyParser = value;
	}

	private _schemaParser!: SchemaParserInterface;
	public get schemaParser(): SchemaParserInterface {
		return this._schemaParser;
	}
	public set schemaParser(value: SchemaParserInterface) {
		this._schemaParser = value;
	}

	private _router!: RouterInterface;
	public get router(): RouterInterface {
		return this._router;
	}
	public set router(value: RouterInterface) {
		this._router = value;
	}

	private _docs!: Map<string, RegistryDocEntry>;
	public get docs(): Map<string, RegistryDocEntry> {
		return this._docs;
	}
	private set docs(value: Map<string, RegistryDocEntry>) {
		this._docs = value;
	}
}

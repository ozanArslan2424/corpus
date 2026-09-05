import type { Context, ContextHandler } from "@/Context";
import { Exception } from "@/Exception";
import { createCacheControlHeader, HeaderKey, type CacheControlDefinition } from "@/Headers";
import { Method } from "@/Request";
import { Status, type Res } from "@/Res";
import {
	resolveRouteAddress,
	RouteBase,
	RouteVariant,
	type RouteAddress,
	type RouteConfig,
} from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isUndefined, type Nullable, isNull, type MaybePromise } from "@/utils/maybe";
import { XFile } from "@/XFile";

type StaticRouteCallback<B = unknown, S = unknown, P = unknown> = (
	context: Context<B, S, P, StaticRouteRes>,
	content: string,
) => MaybePromise<StaticRouteRes>;

type StaticRouteRes = Uint8Array | string | Res;

interface StaticRouteConfig<B = unknown, S = unknown, P = unknown> extends RouteConfig<
	B,
	S,
	P,
	StaticRouteRes
> {
	cache?: CacheControlDefinition;
}

class StaticRoute<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, StaticRouteRes, E> {
	constructor();
	constructor(
		address: RouteAddress<E>,
		filePath: string,
		callback?: StaticRouteCallback<B, S, P>,
		config?: StaticRouteConfig<B, S, P>,
	);
	constructor(
		address?: RouteAddress<E>,
		filePath?: string,
		callback?: StaticRouteCallback<B, S, P>,
		config?: StaticRouteConfig<B, S, P>,
	) {
		super();

		if (new.target !== StaticRoute) return;
		assertDefined(address, "address is required when StaticRoute is constructed directly.");
		assertDefined(filePath, "filePath is required when StaticRoute is constructed directly.");

		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.endpoint;
		this.method = resolved.method;
		const { cache, ...model } = config ?? {};
		this.config = model;
		this.cacheHeader = createCacheControlHeader(
			cache ?? { public: true, maxAge: 3600, noCache: false },
		);
		this.callback = callback;
		this.file = new XFile(filePath);
		if (this.file.exists()) this.bytes = this.file.bytes();
		this.register();
	}

	file: Nullable<XFile> = null;
	bytes: Nullable<Uint8Array> = null;
	cacheHeader: string = "";
	callback?: StaticRouteCallback<B, S, P>;
	onFileNotFound: () => Promise<StaticRouteRes> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	override readonly variant: RouteVariant = RouteVariant.static;
	override method: Method = Method.GET;
	override endpoint!: E;
	override config?: RouteConfig<B, S, P, StaticRouteRes>;
	override handler: ContextHandler<B, S, P, StaticRouteRes> = (c) => {
		if (isNull(this.file)) return this.onFileNotFound();
		if (isNull(this.bytes)) return this.onFileNotFound();
		c.res.headers.set(HeaderKey.ContentType, this.file.mimeType);
		c.res.headers.set(HeaderKey.CacheControl, this.cacheHeader);
		c.res.headers.set(HeaderKey.ContentLength, this.bytes.byteLength.toString());
		if (isUndefined(this.callback)) return this.bytes;
		const decoder = new TextDecoder();
		return this.callback(c, decoder.decode(this.bytes));
	};
}

export { StaticRoute };

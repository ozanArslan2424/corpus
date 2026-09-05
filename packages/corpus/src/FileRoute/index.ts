import type { ContextHandler } from "@/Context";
import { Exception } from "@/Exception";
import {
	type ContentDispositionDefinition,
	type CacheControlDefinition,
	createCacheControlHeader,
	createContentDispositionHeader,
	HeaderKey,
} from "@/Headers";
import { Method } from "@/Request";
import { Status } from "@/Res";
import {
	RouteBase,
	type RouteAddress,
	resolveRouteAddress,
	RouteVariant,
	type RouteConfig,
} from "@/RouteBase";
import { assertDefined } from "@/utils/assert";
import { isString } from "@/utils/lexical";
import { isNil } from "@/utils/maybe";
import { XFile } from "@/XFile";

interface FileRouteDefinition {
	filePath: string;
	disposition?: ContentDispositionDefinition["disposition"];
	cache?: CacheControlDefinition;
}

type FileRouteRes = ReadableStream<Uint8Array> | Uint8Array | string;

class FileRoute<E extends string = string> extends RouteBase<never, never, never, FileRouteRes, E> {
	constructor();
	constructor(address: RouteAddress<E>, definition: FileRouteDefinition | string);
	constructor(address?: RouteAddress<E>, definition?: FileRouteDefinition | string) {
		super();

		if (new.target !== FileRoute) return;
		assertDefined(address, "address is required when FileRoute is constructed directly.");
		assertDefined(definition, "definition is required when FileRoute is constructed directly.");

		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.endpoint;
		this.method = resolved.method;
		if (isString(definition)) {
			this.filePath = definition;
		} else {
			this.filePath = definition.filePath;
			if (!isNil(definition.disposition)) this.disposition = definition.disposition;
			if (!isNil(definition.cache)) this.cache = definition.cache;
		}

		this.register();
	}

	filePath!: string;
	disposition?: ContentDispositionDefinition["disposition"];
	cache: CacheControlDefinition = {
		public: true,
		maxAge: 3600,
		noCache: false,
	};
	onFileNotFound: () => Promise<FileRouteRes> = () => {
		throw new Exception(Status.NOT_FOUND.toString(), Status.NOT_FOUND);
	};

	override readonly variant: RouteVariant = RouteVariant.file;
	override method: Method = Method.GET;
	override endpoint!: E;
	override config?: RouteConfig<never, never, never, FileRouteRes> | undefined;
	override handler: ContextHandler<never, never, never, FileRouteRes> = async (c) => {
		const file = new XFile(this.filePath);
		const exists = file.exists();
		if (!exists) return await this.onFileNotFound();
		const cacheHeader = createCacheControlHeader(this.cache);

		if (!isNil(this.disposition)) {
			const stream = file.stream();
			c.res.headers.set(HeaderKey.ContentType, file.mimeType);
			c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
			c.res.headers.set(
				HeaderKey.ContentDisposition,
				createContentDispositionHeader({
					disposition: this.disposition,
					filename: file.fullname,
				}),
			);
			return stream;
		}

		const content = file.bytes();
		c.res.headers.set(HeaderKey.ContentType, file.mimeType);
		c.res.headers.set(HeaderKey.CacheControl, cacheHeader);
		c.res.headers.set(HeaderKey.ContentLength, content.byteLength.toString());
		return content;
	};
}

export { FileRoute };

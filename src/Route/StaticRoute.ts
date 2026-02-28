import { Method } from "@/Request/enums/Method";
import { RouteVariant } from "@/Route/enums/RouteVariant";
import { FileWalker } from "@/FileWalker/FileWalker";
import { HttpError } from "@/Error/HttpError";
import { JS } from "@/JS";
import { RouteAbstract } from "@/Route/RouteAbstract";
import type { RouteHandler } from "@/Route/types/RouteHandler";
import type { RouteId } from "@/Route/types/RouteId";
import type { RouteModel } from "@/Model/types/RouteModel";
import { getRouterInstance } from "@/index";
import { CommonHeaders } from "@/Headers/enums/CommonHeaders";
import type { StaticRouteHandler } from "@/Route/types/StaticRouteHandler";

/**
 * The object to define a route that serves a static file. Can be instantiated with "new" or inside a controller
 * with {@link ControllerAbstract.staticRoute}. The callback recieves the {@link Context} and can
 * return {@link HttpResponse} or any data. Route instantiation automatically registers
 * to the router.
 * */

export class StaticRoute<
	Path extends string = string,
	B = unknown,
	S = unknown,
	P = unknown,
> extends RouteAbstract<Path, B, S, P, string> {
	constructor(
		path: Path,
		private filePath: string,
		handler?: StaticRouteHandler<B, S, P>,
		model?: RouteModel<B, S, P, string>,
	) {
		super();
		this.variant = RouteVariant.static;
		this.endpoint = this.resolveEndpoint(path, this.variant);
		this.method = Method.GET;
		this.pattern = this.resolvePattern(this.endpoint);
		this.id = this.resolveId(this.method, this.endpoint);
		this.model = model;

		if (handler) {
			this.handler = async (c) => {
				const content = await this.defaultHandler(c);
				return handler(c, content);
			};
		} else {
			this.handler = this.defaultHandler;
		}

		getRouterInstance().addRoute(this);
	}

	id: RouteId;
	variant: RouteVariant;
	method: Method;
	endpoint: Path;
	pattern: RegExp;
	model?: RouteModel<B, S, P, string> | undefined;
	handler: RouteHandler<B, S, P, string>;

	private defaultHandler: RouteHandler<B, S, P, string> = async (c) => {
		let content = "";

		switch (this.extension) {
			case "html":
				content = await this.handleHtml();
				break;
			case "css":
				content = await this.handleCss();
				break;
			case "js":
				content = await this.handleJs();
				break;
			case "ts":
				content = await this.handleTs();
				break;
			default:
				content = await this.handleFile();
				break;
		}

		c.res.headers.set(
			CommonHeaders.ContentType,
			this.mimeTypes[this.extension] || "application/octet-stream",
		);

		c.res.headers.set(CommonHeaders.ContentLength, content.length.toString());

		return content;
	};

	private get extension(): string {
		return this.filePath.split(".").pop() || "txt";
	}

	private get fileName(): string {
		return this.filePath.split("/").pop() ?? "unknown.ts";
	}

	private async getContent(): Promise<string> {
		const content = await FileWalker.read(this.filePath);
		if (!content) {
			console.error("File not found at:", this.filePath);
			throw HttpError.notFound();
		}
		return content;
	}

	private mimeTypes: Record<string, string> = {
		html: "text/html",
		htm: "text/html",
		css: "text/css",
		js: "application/javascript",
		ts: "application/javascript",
		mjs: "application/javascript",
		json: "application/json",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		ico: "image/x-icon",
		txt: "text/plain",
		xml: "application/xml",
		pdf: "application/pdf",
		zip: "application/zip",
		mp3: "audio/mpeg",
		mp4: "video/mp4",
		webm: "video/webm",
		woff: "font/woff",
		woff2: "font/woff2",
		ttf: "font/ttf",
	};

	private async handleHtml() {
		return await this.getContent();
	}

	private async handleCss() {
		return await this.getContent();
	}

	private async handleJs() {
		return await this.getContent();
	}

	private async handleTs() {
		const fileName = this.fileName;
		const content = await this.getContent();
		return await JS.transpile(fileName, content);
	}

	// TODO: Compress images and other binary files
	private async handleFile() {
		return await this.getContent();
	}
}

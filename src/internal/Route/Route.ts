import type { Method } from "@/internal/Method/Method";
import { RouteContext } from "@/internal/Context/RouteContext";
import { textSplit } from "@/utils/textSplit";
import { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";
import type { Endpoint } from "@/internal/Route/Endpoint";
import type { RouteCallback } from "@/internal/Route/RouteCallback";
import type { RouteHandler } from "@/internal/Route/RouteHandler";
import type { RouteSchemas } from "@/internal/Route/RouteSchemas";
import type { RouteHandleSequence } from "@/internal/Route/RouteHandleSequence";

export class Route<
	D = any,
	R = unknown,
	B = unknown,
	S = unknown,
	P = unknown,
> {
	id: string;
	pattern: RegExp;
	paramNames: string[];

	constructor(
		readonly method: Method,
		readonly path: Endpoint,
		readonly callback: RouteCallback<D, R, B, S, P>,
		readonly schemas?: RouteSchemas<R, B, S, P>,
		readonly sequence?: RouteHandleSequence<D, R, B, S, P>,
	) {
		this.id = this.getId(method, path);
		this.pattern = this.getPattern(path);
		this.paramNames = this.getParamNames(path);
	}

	handler: RouteHandler<D, R, B, S, P> = async (req, ctx) => {
		const context = this.getContext(req, ctx);
		const returnData = await this.getReturnData(context);

		if (returnData instanceof CoreumResponse) {
			return returnData;
		}

		return new CoreumResponse(returnData, {
			status: context.status,
			statusText: context.statusText,
			headers: context.headers,
			cookies: context.cookies,
		});
	};

	private getContext(req: Request, ctx?: RouteContext<D, R, B, S, P>) {
		return ctx ?? new RouteContext(req, this.path, this.schemas);
	}

	private async getReturnData(context: RouteContext<D, R, B, S, P>) {
		if (this.sequence?.beforeCallback) {
			context = await this.sequence.beforeCallback(context);
		}

		let returnData = await this.callback(context);

		if (this.sequence?.afterCallback) {
			returnData = await this.sequence.afterCallback(context, returnData);
		}

		return returnData;
	}

	private getPattern(path: string) {
		// Convert route pattern to regex: "/users/:id" -> /^\/users\/([^\/]+)$/
		const regex = path
			.split("/")
			.map((part) => (part.startsWith(":") ? "([^\\/]+)" : part))
			.join("/");
		const pattern = new RegExp(`^${regex}$`);
		return pattern;
	}

	private getParamNames(path: string) {
		const paramNames: string[] = [];

		for (const part of textSplit("/", path)) {
			if (part.startsWith(":")) {
				paramNames.push(part.slice(1));
			}
		}

		return paramNames;
	}

	private getId(method: string, path: string) {
		return `[${method}]:[${path}]`;
	}
}

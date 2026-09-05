import { getNearestApp } from "@/AppsRegistry";
import { Context, type ContextHandler } from "@/Context";
import { HeaderKey } from "@/Headers";
import { Method } from "@/Request";
import type { InferSchemaOut, Schema } from "@/SchemaParser";
import { arrIncludes } from "@/utils/array";
import { assert } from "@/utils/assert";
import { enumerate, type ValueOf } from "@/utils/enum";
import type { MaybePromise } from "@/utils/maybe";
import { isObject, objGetEntries, objGetValues, type Prettify } from "@/utils/object";
import { joinPathSegments } from "@/utils/path";

const RouteVariant = enumerate({
	static: "static",
	file: "file",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
});

type RouteVariant = ValueOf<typeof RouteVariant>;

type RouteHandleInput<B, S, P> = {
	body?: B;
	search?: S;
	params?: P;
	headers?: HeadersInit;
};

type RouteConfig<B = unknown, S = unknown, P = unknown, R = unknown> = {
	maxRequestBodySize?: number;
	response?: Schema<R>;
	body?: Schema<B>;
	search?: Schema<S>;
	params?: Schema<P>;
};

/** If you prefer to put all schemas into a single object, this will be helpful */
type InferModel<T extends Record<string, any>> = {
	[K in keyof T as K extends "prototype" ? never : K]: T[K] extends RouteConfig<any, any, any, any>
		? Prettify<
				(T[K]["body"] extends Schema ? { body: InferSchemaOut<T[K]["body"]> } : {}) &
					(T[K]["search"] extends Schema ? { search: InferSchemaOut<T[K]["search"]> } : {}) &
					(T[K]["params"] extends Schema ? { params: InferSchemaOut<T[K]["params"]> } : {}) &
					(T[K]["response"] extends Schema ? { response: InferSchemaOut<T[K]["response"]> } : {})
			>
		: T[K] extends Schema
			? InferSchemaOut<T[K]>
			: never;
};

type RouteAddress<E extends string = string> =
	| E
	| `${Method} ${E}`
	| `${Lowercase<Method>} ${E}`
	| { method: Method; endpoint: E };

function resolveRouteAddress<E extends string>(
	address: RouteAddress<E>,
): { endpoint: E; method: Method } {
	if (typeof address !== "string") return address;
	if (!address.includes(" ")) return { method: Method.GET, endpoint: address as E };

	const [method, endpoint] = address.split(" ");
	assert(
		arrIncludes(method?.toUpperCase(), Array.from(objGetValues(Method))),
		`Route address cannot include whitespaces unless it starts with an HTTP verb. Received: ${address}`,
	);
	assert(
		typeof endpoint === "string" && endpoint.trim() !== "",
		`Route address cannot include whitespaces unless it starts with an HTTP verb and ends with a path. Received: ${address}`,
	);
	return { method: method.toUpperCase() as Method, endpoint: endpoint as E };
}

abstract class RouteBase<B = any, S = any, P = any, R = any, E extends string = string> {
	abstract readonly variant: RouteVariant;
	abstract readonly method: Method;
	abstract readonly endpoint: E;
	abstract readonly config?: RouteConfig<B, S, P, R>;
	// Has to be a method to circumvent any/never typescript errors
	abstract handler(
		...args: Parameters<ContextHandler<B, S, P, R>>
	): ReturnType<ContextHandler<B, S, P, R>>;

	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	register() {
		getNearestApp().routes.push(this);
	}

	handle(data: RouteHandleInput<B, S, P>): MaybePromise<R> {
		const context = new Context<B, S, P, R>(this.request(data), null);

		if (isObject(data.body)) context.body = data.body;
		if (isObject(data.params)) context.params = data.params;
		if (isObject(data.search)) context.search = data.search;

		return this.handler(context);
	}

	request(data: RouteHandleInput<B, S, P>): Request {
		const app = getNearestApp();
		let endpoint = joinPathSegments(app.prefix, this.endpoint);

		if (isObject(data.params)) {
			for (const [key, value] of Object.entries(data.params)) {
				endpoint = endpoint.replace(`:${key}`, String(value));
			}
		}

		const url = new URL(endpoint, app.baseUrl);

		if (isObject(data.search)) {
			for (const [key, value] of objGetEntries(data.search)) {
				url.searchParams.set(String(key), String(value));
			}
		}

		const headers = new Headers(data.headers);

		let body: BodyInit | undefined = undefined;

		if (data.body instanceof FormData) {
			body = data.body;
		} else if (isObject(data.body)) {
			body = JSON.stringify(data.body);
			headers.set(HeaderKey.ContentType, "application/json");
		}

		return new Request(url, { method: this.method, body, headers });
	}
}

export type { RouteConfig, RouteAddress, InferModel };
export { RouteBase, RouteVariant, resolveRouteAddress };

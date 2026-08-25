import { isObject, objGetEntries } from "@ozanarslan/utils";

import { Context } from "@/Context/Context";
import { HeaderKey } from "@/enums/HeaderKey";
import { Method } from "@/enums/Method";
import { $registry } from "@/registry";
import { joinPathSegments } from "@/Route/joinPathSegments";
import type { ContextHandler, RouteModel, RouteVariant } from "@/Route/types";

type RouteHandleInput<B, S, P> = {
	body?: B;
	search?: S;
	params?: P;
	headers?: HeadersInit;
};

export abstract class BaseRoute<B = any, S = any, P = any, R = any, E extends string = string> {
	get id(): string {
		return `${this.method.toUpperCase()} ${this.endpoint}`;
	}

	abstract handler: ContextHandler<B, S, P, R>;

	abstract endpoint: E;

	abstract method: Method;

	abstract readonly variant: RouteVariant;

	model?: RouteModel<B, S, P, R> | undefined = undefined;

	register(): void {
		$registry.register("route", this);
	}

	handle(data: RouteHandleInput<B, S, P>): Bun.MaybePromise<R> {
		let context = new Context<B, S, P, R>(this.request(data), null);

		if (isObject(data.body)) context.body = data.body;
		if (isObject(data.params)) context.params = data.params;
		if (isObject(data.search)) context.search = data.search;

		return this.handler(context);
	}

	request(data: RouteHandleInput<B, S, P>): Request {
		let endpoint = joinPathSegments($registry.prefix, this.endpoint);

		if (isObject(data.params)) {
			for (const [key, value] of Object.entries(data.params)) {
				endpoint = endpoint.replace(`:${key}`, String(value));
			}
		}

		const url = new URL(endpoint, $registry.baseUrl);

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

		return new Request(url, {
			method: this.method,
			body,
			headers,
		});
	}
}

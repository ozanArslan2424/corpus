import { isNil } from "@/utils/nil";

import { BaseRouteAbstract } from "@/BaseRoute/BaseRouteAbstract";
import type { RouteAddress } from "@/BaseRoute/RouteAddress";
import type { RouteModel } from "@/BaseRoute/RouteModel";
import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";
import { Method } from "@/Method/Method";
import { Res } from "@/Res/Res";
import { StaticRouteAbstract } from "@/StaticRoute/StaticRouteAbstract";
import type { StaticRouteCallback } from "@/StaticRoute/StaticRouteCallback";
import type { StaticRouteDefinition } from "@/StaticRoute/StaticRouteDefinition";

type R = Res | string;

/**
 * Defines a route that serves a static file. Accepts a path and a {@link StaticRouteDefinition}
 * which can either be a plain file path string for a standard file response, or an object
 * with `stream: true` to stream the file directly from disk — useful for large files like
 * videos, PDFs, or large assets where reading the entire file into memory is undesirable.
 *
 * An optional custom handler can be provided to intercept the file content before it is sent,
 * for example to modify headers or transform the content. Route instantiation automatically
 * registers to the router.
 *
 * @example
 * // Serve a file normally
 * new StaticRoute("/style", "assets/style.css");
 *
 * // Stream a large file
 * new StaticRoute("/video", { filePath: "assets/video.mp4", stream: true });
 *
 * // Custom handler
 * new StaticRoute("/doc", "assets/doc.txt", (c, content) => {
 *     c.res.headers.set("x-custom", "value");
 *     return content;
 * });
 */

export class StaticRoute<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends StaticRouteAbstract<B, S, P, E> {
	constructor(
		address: RouteAddress<E>,
		definition: StaticRouteDefinition,
		callback?: StaticRouteCallback<B, S, P>,
		model?: RouteModel<B, S, P, R>,
	) {
		super();
		const resolved = BaseRouteAbstract.resolveAddress(address);
		this.endpoint = resolved.path;
		this.method = resolved.method;
		this.callback = callback;
		this.model = model;

		if (typeof definition === "string") {
			this.filePath = definition;
		} else {
			this.filePath = definition.filePath;
			if (!isNil(definition.disposition)) this.disposition = definition.disposition;
			if (!isNil(definition.cache)) this.cache = definition.cache;
		}

		this.register();
	}

	override endpoint: E;
	override method: Method = Method.GET;
	override callback?: StaticRouteCallback<B, S, P> | undefined;
	override filePath: string;
	override disposition?: "attachment" | "inline" | undefined;
	override cache: CacheControlDirectiveInterface = { public: true, maxAge: 3600, noCache: false };
}

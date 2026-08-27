import type { Context } from "@/C/Context/Context";
import { resolveRouteAddress } from "@/C/RouteBase/resolveRouteAddress";
import type { RouteAddress, RouteModel } from "@/C/RouteBase/RouteBase.types";
import { StaticRouteAbstract } from "@/C/StaticRoute/StaticRoute.abstract";
import type { StaticRouteRes } from "@/C/StaticRoute/StaticRoute.types";
import type { Func } from "@/utils";

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
		filePath: string,
		callback?: Func<
			[context: Context<B, S, P, StaticRouteRes>, content: string],
			Bun.MaybePromise<StaticRouteRes>
		>,
		model?: RouteModel<B, S, P, StaticRouteRes>,
	) {
		super();
		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.path;
		this.method = resolved.method;
		this.model = model;
		if (callback) this.callback = callback;
		this.filePath = filePath;
		this.register();
	}

	override endpoint: E;
	override filePath: string;
}

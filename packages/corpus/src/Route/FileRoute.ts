import { FileRouteAbstract } from "@/Route/FileRouteAbstract";
import { resolveRouteAddress } from "@/Route/resolveRouteAddress";
import type { FileRouteDefinition, RouteAddress } from "@/Route/types";
import { isString, isNil } from "@/utils/is";

/**
 * Defines a route that serves a static file. Accepts a path and a {@link FileRouteDefinition}
 * which can either be a plain file path string for a standard file response, or an object
 * with `stream: true` to stream the file directly from disk — useful for large files like
 * videos, PDFs, or large assets where reading the entire file into memory is undesirable.
 *
 * @example
 * // Serve a file normally
 * new FileRoute("/style", "assets/style.css");
 *
 * // Stream a large file
 * new FileRoute("/video", { filePath: "assets/video.mp4", stream: true });
 */
export class FileRoute<E extends string = string> extends FileRouteAbstract<E> {
	constructor(address: RouteAddress<E>, definition: FileRouteDefinition) {
		super();
		const resolved = resolveRouteAddress(address);
		this.endpoint = resolved.path;
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

	override endpoint: E;
	override filePath: string;
}

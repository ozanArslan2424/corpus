import { BundleRouteAbstract } from "@/Route/BundleRouteAbstract";
import type { BundleRouteCacheConfig } from "@/Route/types";
import { isNil } from "@/utils/nil";

export class BundleRoute<
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends BundleRouteAbstract<B, S, P, E> {
	constructor(path: E, dir: string, cache?: BundleRouteCacheConfig) {
		super();
		this.endpoint = path;
		this.dir = dir;
		if (!isNil(cache)) this.cache = cache;
		this.register();
	}

	override dir: string;
	override endpoint: E;
}

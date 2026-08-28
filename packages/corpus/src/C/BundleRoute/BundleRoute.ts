import { BundleRouteAbstract } from "@/C/BundleRoute/BundleRoute.abstract";
import type { BundleRouteCacheConfig } from "@/C/BundleRoute/BundleRoute.types";
import { isNil } from "@/utils";

export class BundleRoute<E extends string = string> extends BundleRouteAbstract<E> {
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

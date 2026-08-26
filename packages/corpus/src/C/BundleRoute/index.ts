import { isNil } from "@ozanarslan/utils";

import { BundleRouteAbstract } from "@/C/BundleRouteAbstract";
import type { BundleRouteCacheConfig } from "@/C/Route/types";

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

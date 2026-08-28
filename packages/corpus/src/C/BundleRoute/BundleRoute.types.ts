import type { CacheControlDefinition } from "@/C/Headers/Headers.types";

export type BundleRouteCacheConfig = {
	indexHtml: CacheControlDefinition;
	assetsDir: CacheControlDefinition;
	fallback?: CacheControlDefinition;
};

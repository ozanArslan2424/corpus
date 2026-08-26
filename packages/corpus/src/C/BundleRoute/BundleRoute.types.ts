import type { CacheControlDirective } from "@/C/CacheControlDirective/CacheControlDirective";

export type BundleRouteCacheConfig = {
	/** Strategy for index.html */
	indexHtml: CacheControlDirective;
	/** Strategy for the assets folder */
	assetsDir: CacheControlDirective;
	/** Optional: Strategy for other root files (favicon, robots.txt, etc.) */
	fallback?: CacheControlDirective;
};

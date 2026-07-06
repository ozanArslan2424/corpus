import type { Func } from "@/utils/functions";

import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";
import type { Res } from "@/Res/Res";

export type BundleRouteConfig = {
	onFileNotFound: Func<[], Promise<Res>>;
	onIgnore: Func<[], Promise<Res>>;
	assetsDir: string;
	ignore: string[];
	cache: {
		/** Strategy for index.html */
		indexHtml: CacheControlDirectiveInterface | "no-cache";
		/** Strategy for the /assets/ folder */
		assetsDir: CacheControlDirectiveInterface;
		/** Optional: Strategy for other root files (favicon, robots.txt, etc.) */
		fallback?: CacheControlDirectiveInterface;
	};
};

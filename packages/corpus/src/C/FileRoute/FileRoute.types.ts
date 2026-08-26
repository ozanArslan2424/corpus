import type { CacheControlDirective } from "@/C/CacheControlDirective/CacheControlDirective";
import type { ContentDispositionDirective } from "@/C/ContentDispositionDirective/ContentDispositionDirective";

export type FileRouteDefinition = {
	filePath: string;
	disposition?: ContentDispositionDirective["disposition"];
	cache?: CacheControlDirective;
};

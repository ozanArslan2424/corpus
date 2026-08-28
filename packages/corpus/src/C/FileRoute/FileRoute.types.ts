import type { CacheControlDefinition, ContentDispositionDefinition } from "@/C/Headers";

export type FileRouteDefinition = {
	filePath: string;
	disposition?: ContentDispositionDefinition["disposition"];
	cache?: CacheControlDefinition;
};

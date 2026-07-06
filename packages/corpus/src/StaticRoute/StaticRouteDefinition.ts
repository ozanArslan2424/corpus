import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";

export type StaticRouteDefinition =
	// just the file path, doesn't stream
	| string
	| {
			filePath: string;
			disposition?: "attachment" | "inline";
			cache?: CacheControlDirectiveInterface;
	  };

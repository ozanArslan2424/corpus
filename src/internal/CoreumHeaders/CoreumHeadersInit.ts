import type { CoreumHeaderKey } from "@/internal/CoreumHeaders/CoreumHeaderKey";

export type CoreumHeadersInit =
	| (Record<string, string> & {
			[K in CoreumHeaderKey]?: string;
	  })
	| [string, string][]
	| Headers;

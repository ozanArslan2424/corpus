import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumHeaderKey } from "@/internal/types/CoreumHeaderKey";

export type CoreumHeadersInit =
	| Headers
	| CoreumHeadersInterface
	| [string, string][]
	| (Record<string, string> & Partial<Record<CoreumHeaderKey, string>>);

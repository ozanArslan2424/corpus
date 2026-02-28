import type { HttpHeaders } from "@/Headers/HttpHeaders";
import type { HttpHeaderKey } from "@/Headers/types/HttpHeaderKey";

export type HttpHeadersInit =
	| Headers
	| HttpHeaders
	| [string, string][]
	| (Record<string, string> & Partial<Record<HttpHeaderKey, string>>);

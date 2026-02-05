import type { CoreumHeaderKey } from "@/internal/CoreumHeaders/CoreumHeaderKey";

export type CorsConfig = {
	allowedOrigins?: string[];
	allowedMethods?: string[];
	allowedHeaders?: CoreumHeaderKey[];
	credentials?: boolean;
};

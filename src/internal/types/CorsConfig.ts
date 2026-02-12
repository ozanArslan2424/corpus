import type { CoreumHeaderKey } from "@/internal/types/CoreumHeaderKey";

export type CorsConfig = {
	allowedOrigins?: string[];
	allowedMethods?: string[];
	allowedHeaders?: CoreumHeaderKey[];
	credentials?: boolean;
};

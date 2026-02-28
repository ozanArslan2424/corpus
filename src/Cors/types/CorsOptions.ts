import type { HttpHeaderKey } from "../../Headers/types/HttpHeaderKey";

export type CorsOptions = {
	allowedOrigins?: string[];
	allowedMethods?: string[];
	allowedHeaders?: HttpHeaderKey[];
	credentials?: boolean;
};

import type { HTMLBundle_BunOnly } from "@/internal/types/HTMLBundle_BunOnly";
import type { ErrorCallback } from "@/internal/types/ErrorCallback";
import type { FetchCallback } from "@/internal/types/FetchCallback";

export type CoreumServerOptions = {
	staticPages?: Record<string, HTMLBundle_BunOnly>;
	onError?: ErrorCallback;
	onNotFound?: FetchCallback;
};

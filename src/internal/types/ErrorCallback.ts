import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";

export type ErrorCallback<R = unknown> = (
	err: Error,
) => Promise<CoreumResponseInterface<R>>;

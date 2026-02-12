import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";

export type FetchCallback<R = unknown> = (
	req: CoreumRequestInterface,
) => Promise<CoreumResponseInterface<R>>;

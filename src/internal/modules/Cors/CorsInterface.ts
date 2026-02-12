import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";
import type { CorsConfig } from "@/internal/types/CorsConfig";

export interface CorsInterface {
	readonly config: CorsConfig;
	getCorsHeaders(
		req: CoreumRequestInterface,
		res: CoreumResponseInterface,
	): CoreumHeadersInterface;
	apply(req: CoreumRequestInterface, res: CoreumResponseInterface): void;
}

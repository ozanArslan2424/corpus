import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";

import type { CoreumRequestInfo } from "@/internal/types/CoreumRequestInfo";
import type { CoreumRequestInit } from "@/internal/types/CoreumRequestInit";

export interface CoreumRequestInterface extends Request {
	readonly input: CoreumRequestInfo;
	readonly init?: CoreumRequestInit;
	readonly cookies: CookiesInterface;
	get isPreflight(): boolean;
	get normalizedContentType(): string;
}

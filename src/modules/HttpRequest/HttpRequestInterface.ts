import type { CookiesInterface } from "@/modules/Cookies/CookiesInterface";

import type { HttpRequestInfo } from "@/modules/HttpRequest/types/HttpRequestInfo";
import type { HttpRequestInit } from "@/modules/HttpRequest/types/HttpRequestInit";

export interface HttpRequestInterface extends Request {
	readonly input: HttpRequestInfo;
	readonly init?: HttpRequestInit;
	readonly cookies: CookiesInterface;
	get isPreflight(): boolean;
}

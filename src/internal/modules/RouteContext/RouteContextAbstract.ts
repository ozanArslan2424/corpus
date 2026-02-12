import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import type { RouteContextInterface } from "@/internal/modules/RouteContext/RouteContextInterface";
import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";

export class RouteContextAbstract<
	B = unknown,
	S = unknown,
	P = unknown,
> implements RouteContextInterface<B, S, P> {
	constructor(
		readonly req: CoreumRequestInterface,
		readonly url: URL,
		readonly headers: CoreumHeadersInterface,
		readonly cookies: CookiesInterface,
		readonly body: B,
		readonly search: S,
		readonly params: P,
		res: CoreumResponseInterface,
	) {
		this.res = res;
	}

	res: CoreumResponseInterface;
	data: Record<string, unknown> = {};
}

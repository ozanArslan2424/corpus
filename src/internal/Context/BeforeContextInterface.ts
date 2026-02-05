import type { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import type { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";

export interface BeforeContextInterface<D = void> {
	req: CoreumRequest;
	readonly path: string;
	url: URL;
	headers: CoreumHeaders;
	cookies: CoreumCookies;
	data?: D;
}

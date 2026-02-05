import type { BeforeContext } from "@/internal/Context/BeforeContext";
import type { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import type { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";
import type { Status } from "@/internal/Status/Status";

export interface RouteContextInterface<
	D = void,
	B = unknown,
	S = unknown,
	P = unknown,
> {
	req: CoreumRequest;
	readonly path: string;
	url: URL;
	headers: CoreumHeaders;
	cookies: CoreumCookies;
	status: Status;
	statusText: string;
	body: () => Promise<B>;
	search: S;
	params: P;
	data?: D | BeforeContext<D>;
}

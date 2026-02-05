import type { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import type { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { Status } from "@/internal/Status/Status";

export type CoreumResponseInit = {
	cookies?: CoreumCookies;
	headers?: HeadersInit | CoreumHeaders;
	status?: Status;
	statusText?: string;
};

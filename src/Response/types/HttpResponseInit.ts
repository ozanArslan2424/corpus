import type { Status } from "@/Response/enums/Status";
import type { CookiesInit } from "@/Cookies/types/CookiesInit";
import type { HttpHeadersInit } from "@/Headers/types/HttpHeadersInit";

export type HttpResponseInit = {
	cookies?: CookiesInit;
	headers?: HttpHeadersInit;
	status?: Status;
	statusText?: string;
};

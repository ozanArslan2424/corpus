import type { Status } from "@/internal/enums/Status";
import type { CookiesInit } from "@/internal/types/CookiesInit";
import type { CoreumHeadersInit } from "@/internal/types/CoreumHeadersInit";

export type CoreumResponseInit = {
	cookies?: CookiesInit;
	headers?: CoreumHeadersInit;
	status?: Status;
	statusText?: string;
};

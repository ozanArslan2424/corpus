import { Status } from "@/internal/enums/Status";
import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";

import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumResponseBody } from "@/internal/types/CoreumResponseBody";
import type { CoreumResponseInit } from "@/internal/types/CoreumResponseInit";

export interface CoreumResponseInterface<R = unknown> {
	readonly body?: CoreumResponseBody<R>;
	readonly init?: CoreumResponseInit;
	headers: CoreumHeadersInterface;
	status: Status;
	statusText: string;
	cookies: CookiesInterface;
	get response(): Response;
}

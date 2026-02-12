import type { Method } from "@/internal/enums/Method";

import type { CoreumHeadersInit } from "@/internal/types/CoreumHeadersInit";

export type CoreumRequestInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: CoreumHeadersInit;
	method?: Method;
};

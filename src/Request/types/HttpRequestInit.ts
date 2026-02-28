import type { Method } from "@/Request/enums/Method";
import type { HttpHeadersInit } from "@/Headers/types/HttpHeadersInit";

export type HttpRequestInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: HttpHeadersInit;
	method?: Method;
};

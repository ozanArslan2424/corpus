import type { Method } from "@/enums/Method";
import type { Req } from "@/Req/Req";

export type ReqInfo = Request | string | Req | URL;

export type ReqInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: HeadersInit;
	method?: Method;
};

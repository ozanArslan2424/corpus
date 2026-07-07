import type { CHeadersInit } from "@/CHeaders/types";
import type { Method } from "@/enums/Method";
import type { Req } from "@/Req/Req";

export type ReqInfo = Request | string | Req | URL;

export type ReqInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: CHeadersInit;
	method?: Method;
};

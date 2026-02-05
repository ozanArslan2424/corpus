import type { CoreumHeadersInit } from "@/internal/CoreumHeaders/CoreumHeadersInit";
import type { Method } from "@/internal/Method/Method";

export type CoreumRequestInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: CoreumHeadersInit;
	method: Method;
};

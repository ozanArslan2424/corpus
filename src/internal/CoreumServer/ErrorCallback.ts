import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";

export type ErrorCallback = (err: Error) => Promise<CoreumResponse>;

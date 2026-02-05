import type { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";
import type { CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";

export type FetchCallback = (req: CoreumRequest) => Promise<CoreumResponse>;

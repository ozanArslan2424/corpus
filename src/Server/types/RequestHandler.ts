import type { HttpRequest } from "@/Request/HttpRequest";
import type { HttpResponse } from "@/Response/HttpResponse";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type RequestHandler<R = unknown> = (
	req: HttpRequest,
) => MaybePromise<HttpResponse<R>>;

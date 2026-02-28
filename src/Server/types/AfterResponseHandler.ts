import type { HttpResponse } from "@/Response/HttpResponse";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type AfterResponseHandler =
	| ((res: HttpResponse) => MaybePromise<HttpResponse>)
	| undefined;

import { CommonHeaders } from "@/internal/enums/CommonHeaders";
import { Status } from "@/internal/enums/Status";
import { CoreumResponseAbstract } from "@/internal/modules/CoreumResponse/CoreumResponseAbstract";
import type { CoreumResponseInterface } from "@/internal/modules/CoreumResponse/CoreumResponseInterface";
import type { CoreumResponseInit } from "@/internal/types/CoreumResponseInit";

/**
 * This is NOT the default response. It provides {@link CoreumResponse.response}
 * getter to access web Response with all mutations applied during the
 * handling of the request, JSON body will be handled and cookies will be
 * applied to response headers.
 * */

export class CoreumResponse<R = unknown>
	extends CoreumResponseAbstract<R>
	implements CoreumResponseInterface<R>
{
	static redirect(
		url: string | URL,
		init?: CoreumResponseInit,
	): CoreumResponseInterface {
		const res = new CoreumResponse(undefined, {
			...init,
			status: init?.status ?? Status.FOUND,
			statusText: init?.statusText,
		});
		const urlString = url instanceof URL ? url.toString() : url;
		res.headers.set(CommonHeaders.Location, urlString);
		return res;
	}

	static permanentRedirect(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponseInterface {
		return this.redirect(url, {
			...init,
			status: Status.MOVED_PERMANENTLY,
		});
	}

	static temporaryRedirect(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponseInterface {
		return this.redirect(url, { ...init, status: Status.TEMPORARY_REDIRECT });
	}

	static seeOther(
		url: string | URL,
		init?: Omit<CoreumResponseInit, "status">,
	): CoreumResponseInterface {
		return this.redirect(url, { ...init, status: Status.SEE_OTHER });
	}
}

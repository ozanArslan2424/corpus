import type { CookiesInit } from "@/Cookies/types";
import type { Status } from "@/enums/Status";
import type { Func } from "@/utils/functions";

export type SseSource = Func<
	[send: Func<[item: { data: unknown; event?: string; id?: string }], void>],
	void | Func<[], void>
>;

export type ResInit = {
	cookies?: CookiesInit;
	headers?: HeadersInit;
	status?: Status;
	statusText?: string;
};

export type ResBody<R = unknown> = R | BodyInit | null | undefined;

export type NdjsonSource = Func<[send: Func<[item: unknown], void>], void | Func<[], void>>;

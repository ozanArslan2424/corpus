import type { CookiesAbstract } from "@/C/Cookies";
import type { Status } from "@/C/Res/Status";
import type { Func } from "@/utils";

export type SseSource = Func<
	[send: Func<[item: { data: unknown; event?: string; id?: string }], void>],
	Bun.MaybePromise<void | Func<[], void>>
>;

export type NdjsonSource = Func<
	[send: Func<[item: unknown], void>],
	Bun.MaybePromise<void | Func<[], void>>
>;

export type ResInit = {
	cookies?: CookiesAbstract | string[][] | Record<string, string> | string;
	headers?: HeadersInit;
	status?: Status;
	statusText?: string;
};

import type { Func } from "@ozanarslan/utils";

import type { Status } from "@/C/Status/Status";

export type SseSource = Func<
	[send: Func<[item: { data: unknown; event?: string; id?: string }], void>],
	Bun.MaybePromise<void | Func<[], void>>
>;
export type NdjsonSource = Func<
	[send: Func<[item: unknown], void>],
	Bun.MaybePromise<void | Func<[], void>>
>;

export type ResInit = {
	cookies?: Bun.CookieMap | string[][] | Record<string, string> | string;
	headers?: HeadersInit;
	status?: Status;
	statusText?: string;
};

export type ResBody<R = unknown> = R | BodyInit | null | undefined;

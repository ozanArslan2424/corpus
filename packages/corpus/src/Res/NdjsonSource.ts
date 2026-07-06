import type { Func } from "@/utils/functions";

export type NdjsonSource = Func<[send: Func<[item: unknown], void>], void | Func<[], void>>;

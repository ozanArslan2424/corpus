import type { Res } from "@/C/Res/Res";

export type StaticRouteRes = ReadableStream<Uint8Array> | string | Res;

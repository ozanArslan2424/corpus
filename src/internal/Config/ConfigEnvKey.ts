import type { ConfigEnv } from "@/types";

export type ConfigEnvKey = keyof ConfigEnv | (string & {});

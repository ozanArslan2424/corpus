import type { Env } from "@/types.d.ts";
import type { OrString } from "@/utils/types/OrString";

export type ConfigEnvKey = OrString<keyof Env>;

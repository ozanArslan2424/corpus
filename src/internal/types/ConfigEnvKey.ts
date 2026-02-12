import type { EnvInterface } from "@/internal/interfaces/EnvInterface";

export type ConfigEnvKey = keyof EnvInterface | (string & {});

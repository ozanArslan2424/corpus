export const ACCEPTED_PACKAGE_MANAGERS = ["bun", "pnpm", "npm"];

export const ACCEPTED_VALIDATION_LIBS = ["zod", "arktype", "yup"] as const;
export type ValidationLib = (typeof ACCEPTED_VALIDATION_LIBS)[number] | null;

export const ACTIONS = ["api", "init"];
export type Action = (typeof ACTIONS)[number];

export const CONFIG_FILE_NAME = "corpus.config.ts";
export const DIST_API_GENERATOR_FILE = "generateApiClient/ApiClientGenerator.mjs";
export const API_GENERATOR_CLASS_NAME = "ApiClientGenerator";

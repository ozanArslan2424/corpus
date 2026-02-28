import type { StandardSchemaV1 } from "@/Model/types/StandardSchema";

export interface Schema<T = unknown> extends StandardSchemaV1<unknown, T> {}

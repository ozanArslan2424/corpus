import type { Schema } from "@/Model/types/Schema";
import type { StandardSchemaV1 } from "@/Model/types/StandardSchema";

export type InferSchema<T extends Schema> = StandardSchemaV1.InferOutput<T>;

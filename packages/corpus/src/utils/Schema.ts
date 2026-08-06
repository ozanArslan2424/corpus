import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Schema<T = unknown> = StandardSchemaV1<unknown, T>;

export type InferSchemaIn<T extends Schema> = StandardSchemaV1.InferInput<T>;
export type InferSchemaOut<T extends Schema> = StandardSchemaV1.InferOutput<T>;

export type ValidationIssues = readonly StandardSchemaV1.Issue[];

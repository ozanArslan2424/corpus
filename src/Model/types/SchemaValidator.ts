import type { StandardSchemaV1 } from "@/Model/types/StandardSchema";

export type SchemaValidator<T = unknown> = StandardSchemaV1.Props<
	unknown,
	T
>["validate"];

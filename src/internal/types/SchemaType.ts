import type { Type } from "arktype";
import type { ZodType } from "zod";

export type SchemaType<O = unknown> =
	| ZodType<O> // toJSONSchema
	| Type<O>; // toJsonSchema
